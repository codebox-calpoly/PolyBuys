import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { hasBlockBetween } from './blocks';
import { requireAuthUserId } from './lib/authIdentity';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function displayNameFromProfile(profile: { name?: string } | null, user: { name?: string } | null) {
  const userName = user?.name?.trim();
  if (userName && userName.length > 0) {
    return userName;
  }

  const profileName = profile?.name?.trim();
  if (profileName && profileName.length > 0) {
    return profileName;
  }

  return 'User';
}

/** Returns the stable auth user ID. Throws if not authenticated. */
async function requireStableUserId(
  ctx: MutationCtx | QueryCtx,
  message = 'Unauthorized'
): Promise<Id<'users'>> {
  return await requireAuthUserId(ctx, message);
}

// Internal query: get conversation and verify user is a participant (used by sendMessage action)
export const internalGetConversation = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

// Internal mutation: persists a message and updates conversation (called by sendMessage action after moderation)
export const internalSendMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    senderId: v.string(),
    recipientId: v.string(),
    body: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      listingId: args.listingId,
      senderId: args.senderId,
      recipientId: args.recipientId,
      body: args.body,
      createdAt: now,
      readAt: 0,
      type: args.type,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageId: messageId,
    });

    return { messageId };
  },
});

// Sends a message (action — screens content via moderation before persisting)
export const sendMessage = action({
  args: {
    conversationId: v.id('conversations'),
    body: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ messageId: Id<'messages'> }> => {
    const trimmedBody = args.body.trim();
    // Validate message body length
    if (trimmedBody.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (args.body.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
      throw new ConvexError(`Message must be ${PAYLOAD_BOUNDS.MESSAGE_MAX} characters or less`);
    }

    const type = args.type ?? 'text';

    const userId = await requireAuthUserId(ctx);

    // Participant check via internal query
    const convo = await ctx.runQuery(internal.messages.internalGetConversation, {
      conversationId: args.conversationId,
    });
    if (!convo) {
      throw new ConvexError('Conversation not found');
    }

    const isBuyer = convo.buyerId === userId;
    const isSeller = convo.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ConvexError('Forbidden');
    }

    const senderId = userId;
    const recipientId = isBuyer ? convo.sellerId : convo.buyerId;

    // Block check: neither party can message if either has blocked the other
    const hasBlock = await ctx.runQuery(internal.blocks.internalHasBlockBetween, {
      userIdA: senderId,
      userIdB: recipientId,
    });
    if (hasBlock) {
      throw new ConvexError('You cannot message this user');
    }

    // Screen content via OpenAI Moderation API
    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: args.body,
      contentType: 'message',
      userId,
    });

    if (moderationResult.flagged) {
      throw new ConvexError('Your message was not sent because it contains inappropriate content.');
    }

    // Persist via internal mutation
    const result = await ctx.runMutation(internal.messages.internalSendMessage, {
      conversationId: args.conversationId,
      listingId: convo.listingId,
      senderId,
      recipientId,
      body: args.body,
      type: type,
    });

    // Push notifications are best-effort and should never block message delivery.
    // In production, schedule out-of-band to keep send latency low.
    // In test runs, invoke directly for deterministic assertions and to avoid
    // convex-test scheduler race conditions.
    const notificationArgs = {
      recipientId,
      senderId: userId,
      conversationId: args.conversationId,
      listingId: convo.listingId,
      messageId: result.messageId,
      body: args.body,
    };

    try {
      if (process.env.NODE_ENV === 'test') {
        await ctx.runMutation(
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      }
    } catch (error) {
      console.error('Failed to enqueue push notification for message', error);
    }

    return result;
  },
});

/**
 * Create a conversation (or reuse existing one) and send the first message in one flow.
 * Used when tapping "Message Seller" from a listing.
 */
export const createConversationAndSendFirstMessage = action({
  args: {
    listingId: v.id('listings'),
    body: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<'conversations'> }> => {
    const trimmedBody = args.body.trim();
    if (trimmedBody.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (args.body.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
      throw new ConvexError(`Message must be ${PAYLOAD_BOUNDS.MESSAGE_MAX} characters or less`);
    }

    const type = args.type ?? 'text';
    const buyerId = await requireAuthUserId(ctx);

    const listing = await ctx.runQuery(internal.listings.internalGetListing, {
      id: args.listingId,
    });
    if (!listing) throw new ConvexError('Listing not found');
    if (listing.status !== 'active') throw new ConvexError('Listing is not active');
    if (listing.isHidden) throw new ConvexError('Listing is not available');

    const sellerId = listing.sellerId;
    if (buyerId === sellerId) {
      throw new ConvexError("You can't message yourself");
    }

    const hasBlock = await ctx.runQuery(internal.blocks.internalHasBlockBetween, {
      userIdA: buyerId,
      userIdB: sellerId,
    });
    if (hasBlock) {
      throw new ConvexError('You cannot message this user');
    }

    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: args.body,
      contentType: 'message',
      userId: buyerId,
    });
    if (moderationResult.flagged) {
      throw new ConvexError('Your message was not sent because it contains inappropriate content.');
    }

    const { conversationId } = await ctx.runMutation(
      internal.messages.internalGetOrCreateConversation,
      { listingId: args.listingId, buyerId, sellerId }
    );

    const result = await ctx.runMutation(internal.messages.internalSendMessage, {
      conversationId,
      listingId: args.listingId,
      senderId: buyerId,
      recipientId: sellerId,
      body: args.body,
      type,
    });

    const notificationArgs = {
      recipientId: sellerId,
      senderId: buyerId,
      conversationId,
      listingId: args.listingId,
      messageId: result.messageId,
      body: args.body,
    };

    try {
      if (process.env.NODE_ENV === 'test') {
        await ctx.runMutation(
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      }
    } catch (error) {
      console.error('Failed to enqueue push notification for message', error);
    }

    return { conversationId };
  },
});

//Debug helper for local testing
export const debugCreateConversationID = internalMutation({
  args: {
    listingId: v.id('listings'),
    buyerId: v.id('users'),
    sellerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      participantIds: [args.buyerId, args.sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });

    return { conversationId };
  },
});

//Retrieve all messages for a conversation with conversationID in chronological order
export const getConversationHistory = query({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const { conversationIds } = await requireConversationScope(ctx, args);
    return await collectMessagesForConversationScope(ctx, conversationIds);
  },
});

//List all user conversations a user participates in, ordered by most recent activity
export const listUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStableUserId(ctx);

    const [buyerConversations, sellerConversations] = await Promise.all([
      ctx.db
        .query('conversations')
        .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
        .order('desc')
        .collect(),
      ctx.db
        .query('conversations')
        .withIndex('by_seller', (q) => q.eq('sellerId', userId))
        .order('desc')
        .collect(),
    ]);

    const dedupedConversationIds = new Set<Id<'conversations'>>();
    for (const conversation of [...buyerConversations, ...sellerConversations]) {
      dedupedConversationIds.add(conversation._id);
    }

    const participantConversations = (
      await Promise.all(
        [...dedupedConversationIds].map((conversationId) => ctx.db.get(conversationId))
      )
    )
      .filter((conversation): conversation is Doc<'conversations'> => conversation !== null)
      .filter((conversation) => conversation.buyerId === userId || conversation.sellerId === userId)
      .filter((conversation) => conversation.lastMessageId !== undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // One conversation per listing (stable IDs, no sibling merging needed)
    const groupedConversations = participantConversations.map((conversation) => {
      const isBuyer = conversation.buyerId === userId;
      const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
      return {
        dedupeKey: `${conversation.listingId}:${otherUserId}`,
        primaryConversation: conversation,
        siblingConversations: [conversation],
        otherUserId,
        canonicalOtherUserId: otherUserId,
        mergedUpdatedAt: conversation.updatedAt,
      };
    });

    const listingIds = [
      ...new Set(groupedConversations.map((group) => group.primaryConversation.listingId)),
    ];
    const listingDocs = await Promise.all(listingIds.map((listingId) => ctx.db.get(listingId)));
    const listingById = new Map<Id<'listings'>, Doc<'listings'> | null>();
    for (let index = 0; index < listingIds.length; index += 1) {
      listingById.set(listingIds[index], listingDocs[index]);
    }

    const listingSummariesById = new Map<
      Id<'listings'>,
      { id: Id<'listings'>; title: string; thumbnailUrl: string | null }
    >();
    await Promise.all(
      listingIds.map(async (listingId) => {
        const listing = listingById.get(listingId) ?? null;
        const thumbnailSource = listing?.images?.[0] ?? null;
        let listingThumbnailUrl: string | null = null;
        if (thumbnailSource) {
          if (isRemoteUrl(thumbnailSource)) {
            listingThumbnailUrl = thumbnailSource;
          } else {
            try {
              listingThumbnailUrl = await ctx.storage.getUrl(thumbnailSource as Id<'_storage'>);
            } catch {
              listingThumbnailUrl = null;
            }
          }
        }

        listingSummariesById.set(listingId, {
          id: listingId,
          title: listing?.title ?? 'Listing unavailable',
          thumbnailUrl: listingThumbnailUrl,
        });
      })
    );

    const canonicalOtherUserIds = [
      ...new Set(groupedConversations.map((group) => group.canonicalOtherUserId)),
    ];
    const [userEntries, profileEntries] = await Promise.all([
      Promise.all(
        canonicalOtherUserIds.map(async (otherUserId) => {
          const normalizedOtherUserId = await ctx.db.normalizeId('users', otherUserId);
          const otherUserDoc = normalizedOtherUserId
            ? await ctx.db.get(normalizedOtherUserId)
            : null;
          return [otherUserId, otherUserDoc] as const;
        })
      ),
      Promise.all(
        canonicalOtherUserIds.map(async (otherUserId) => {
          const profile = await ctx.db
            .query('profiles')
            .withIndex('by_userId', (q) => q.eq('userId', otherUserId))
            .first();
          return [otherUserId, profile ?? null] as const;
        })
      ),
    ]);
    const userDocsByCanonicalUserId = new Map<string, Doc<'users'> | null>(userEntries);
    const profilesByCanonicalUserId = new Map<string, Doc<'profiles'> | null>(profileEntries);

    const lastMessageIds = [
      ...new Set(
        groupedConversations.flatMap((group) =>
          group.siblingConversations
            .map((conversation) => conversation.lastMessageId)
            .filter((lastMessageId): lastMessageId is Id<'messages'> => lastMessageId !== undefined)
        )
      ),
    ];
    const lastMessageDocs = await Promise.all(
      lastMessageIds.map((lastMessageId) => ctx.db.get(lastMessageId))
    );
    const lastMessagesById = new Map<Id<'messages'>, Doc<'messages'>>();
    for (let index = 0; index < lastMessageIds.length; index += 1) {
      const message = lastMessageDocs[index];
      if (message) {
        lastMessagesById.set(lastMessageIds[index], message);
      }
    }

    return await Promise.all(
      groupedConversations.map(async (group) => {
        let latestMessage: Doc<'messages'> | null = null;
        for (const siblingConversation of group.siblingConversations) {
          const siblingLastMessageId = siblingConversation.lastMessageId;
          if (!siblingLastMessageId) {
            continue;
          }
          const siblingLastMessage = lastMessagesById.get(siblingLastMessageId);
          if (
            siblingLastMessage &&
            (!latestMessage || siblingLastMessage.createdAt > latestMessage.createdAt)
          ) {
            latestMessage = siblingLastMessage;
          }
        }

        const conversationsMissingLastMessageId = group.siblingConversations.filter(
          (siblingConversation) => !siblingConversation.lastMessageId
        );
        if (conversationsMissingLastMessageId.length > 0) {
          const fallbackMessages = await Promise.all(
            conversationsMissingLastMessageId.map((siblingConversation) =>
              ctx.db
                .query('messages')
                .withIndex('by_conversation_createdAt', (q) =>
                  q.eq('conversationId', siblingConversation._id)
                )
                .order('desc')
                .first()
            )
          );
          for (const fallbackMessage of fallbackMessages) {
            if (
              fallbackMessage &&
              (!latestMessage || fallbackMessage.createdAt > latestMessage.createdAt)
            ) {
              latestMessage = fallbackMessage;
            }
          }
        }

        const unreadByConversation = await Promise.all(
          group.siblingConversations.map((siblingConversation) =>
            ctx.db
              .query('messages')
              .withIndex('by_conversation_recipient_readAt', (q) =>
                q.eq('conversationId', siblingConversation._id)
              )
              .filter((q) => q.eq(q.field('readAt'), 0))
              .collect()
          )
        );
        const unreadCount = unreadByConversation.reduce(
          (count, unreadMessages) =>
            count + unreadMessages.filter((message) => message.recipientId === userId).length,
          0
        );

        const otherProfile = profilesByCanonicalUserId.get(group.canonicalOtherUserId) ?? null;
        const otherUserDoc = userDocsByCanonicalUserId.get(group.canonicalOtherUserId) ?? null;

        return {
          ...group.primaryConversation,
          updatedAt: group.mergedUpdatedAt,
          mergedConversationId: group.primaryConversation._id,
          siblingConversationIds: group.siblingConversations.map(
            (siblingConversation) => siblingConversation._id
          ),
          canonicalOtherUserId: group.canonicalOtherUserId,
          otherUser: {
            id: group.otherUserId,
            name: displayNameFromProfile(otherProfile, otherUserDoc),
          },
          listing: listingSummariesById.get(group.primaryConversation.listingId) ?? {
            id: group.primaryConversation.listingId,
            title: 'Listing unavailable',
            thumbnailUrl: null,
          },
          lastMessagePreview: latestMessage?.body ?? 'Conversation started',
          lastMessageAt: latestMessage?.createdAt ?? group.mergedUpdatedAt,
          unreadCount,
          hasUnread: unreadCount > 0,
        };
      })
    );
  },
});

async function requireConversationScope(
  ctx: MutationCtx | QueryCtx,
  args: {
    conversationId: Id<'conversations'>;
    siblingConversationIds?: Id<'conversations'>[];
  }
) {
  const userId = await requireStableUserId(ctx);
  const scopedConversationIdSet = new Set<Id<'conversations'>>([
    args.conversationId,
    ...(args.siblingConversationIds ?? []),
  ]);
  const scopedConversationIds = [...scopedConversationIdSet];

  const scopedConversations = await Promise.all(
    scopedConversationIds.map((conversationId) => ctx.db.get(conversationId))
  );
  if (scopedConversations.some((conversation) => conversation === null)) {
    throw new ConvexError('Conversation not found');
  }
  const conversations = scopedConversations as Doc<'conversations'>[];
  const primaryConversation = conversations.find(
    (conversation) => conversation._id === args.conversationId
  );
  if (!primaryConversation) {
    throw new ConvexError('Conversation not found');
  }

  const getScopedConversationMeta = (conversation: Doc<'conversations'>) => {
    const isBuyer = conversation.buyerId === userId;
    const isSeller = conversation.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ConvexError('Forbidden');
    }

    const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
    return {
      conversation,
      isBuyer,
      isSeller,
      dedupeKey: `${conversation.listingId}:${otherUserId}`,
    };
  };

  const primaryMeta = getScopedConversationMeta(primaryConversation);
  const conversationScope = conversations.map((conversation) => {
    const scopedMeta = getScopedConversationMeta(conversation);
    if (scopedMeta.dedupeKey !== primaryMeta.dedupeKey) {
      throw new ConvexError('Forbidden');
    }
    return {
      conversation,
      isBuyer: scopedMeta.isBuyer,
      isSeller: scopedMeta.isSeller,
    };
  });

  return {
    userId,
    conversationIds: conversationScope.map(
      (scopedConversation) => scopedConversation.conversation._id
    ),
    conversationScope,
  };
}

async function collectMessagesForConversationScope(
  ctx: MutationCtx | QueryCtx,
  conversationIds: Id<'conversations'>[]
) {
  const messageBatches = await Promise.all(
    conversationIds.map((conversationId) =>
      ctx.db
        .query('messages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId))
        .collect()
    )
  );

  return messageBatches.flat().sort((left, right) => left.createdAt - right.createdAt);
}

// Internal: create conversation if not exists (used by createConversationAndSendFirstMessage)
export const internalGetOrCreateConversation = internalMutation({
  args: {
    listingId: v.id('listings'),
    buyerId: v.string(),
    sellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', args.buyerId).eq('sellerId', args.sellerId)
      )
      .first();

    if (existing) return { conversationId: existing._id };

    const now = Date.now();
    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      participantIds: [args.buyerId, args.sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });

    return { conversationId };
  },
});

export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerId = await requireStableUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new ConvexError('Listing not found');

    // Security: Only allow conversations on active, public listings
    if (listing.status !== 'active') {
      throw new ConvexError('Listing is not active');
    }
    if (listing.isHidden) {
      throw new ConvexError('Listing is not available');
    }

    const sellerId = listing.sellerId;
    if (buyerId === sellerId) {
      throw new ConvexError("You can't message yourself");
    }

    // Block check: neither party can message if either has blocked the other
    const blocked = await hasBlockBetween(ctx, buyerId, sellerId);
    if (blocked) {
      throw new ConvexError('You cannot message this user');
    }

    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', buyerId).eq('sellerId', sellerId)
      )
      .first();

    if (existing) return { conversationId: existing._id };

    const now = Date.now();
    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId,
      sellerId,
      participantIds: [buyerId, sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });

    return { conversationId };
  },
});

// TASK: mark messages as read functionality
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const { conversationScope, userId } = await requireConversationScope(ctx, args);

    const now = Date.now();

    await Promise.all(
      conversationScope.map(async ({ conversation, isBuyer, isSeller }) => {
        if (isBuyer) {
          await ctx.db.patch(conversation._id, { buyerLastReadAt: now });
        } else if (isSeller) {
          await ctx.db.patch(conversation._id, { sellerLastReadAt: now });
        }
      })
    );

    const unreadMessagesByScope = await Promise.all(
      conversationScope.map(({ conversation }) =>
        ctx.db
          .query('messages')
          .withIndex('by_conversation_recipient_readAt', (q) =>
            q.eq('conversationId', conversation._id).eq('recipientId', userId).eq('readAt', 0)
          )
          .collect()
      )
    );
    const unreadMessageIds = new Set<Id<'messages'>>();
    for (const unreadBatch of unreadMessagesByScope) {
      for (const message of unreadBatch) {
        unreadMessageIds.add(message._id);
      }
    }
    await Promise.all(
      [...unreadMessageIds].map((messageId) => ctx.db.patch(messageId, { readAt: now }))
    );

    return { ok: true };
  },
});

// TASK: real-time message delivery (Convex query is reactive when used with useQuery)
export const backfillMessagingFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query('conversations').collect();
    let conversationPatches = 0;

    for (const convo of conversations) {
      if (!convo.participantIds || convo.participantIds.length !== 2) {
        await ctx.db.patch(convo._id, { participantIds: [convo.buyerId, convo.sellerId] });
        conversationPatches += 1;
      }
    }

    const messages = await ctx.db.query('messages').collect();
    let messagePatches = 0;

    for (const message of messages) {
      if (!message.type) {
        await ctx.db.patch(message._id, { type: 'text' });
        messagePatches += 1;
      }
    }

    return { conversationPatches, messagePatches };
  },
});

export const messagesByConversation = query({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const { conversationIds } = await requireConversationScope(ctx, args);
    return await collectMessagesForConversationScope(ctx, conversationIds);
  },
});

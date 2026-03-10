import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v, ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

function canonicalParticipantId(value: string) {
  const [base] = value.split('|');
  return base;
}

function isSameParticipantId(left: string, right: string) {
  return left === right || canonicalParticipantId(left) === canonicalParticipantId(right);
}

function matchesAnyParticipantId(value: string, candidates: string[]) {
  return candidates.some((candidate) => isSameParticipantId(value, candidate));
}

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

async function getParticipantKeys(ctx: MutationCtx | QueryCtx): Promise<string[]> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Unauthorized');

  const keys = new Set<string>([identity.subject]);
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    keys.add(authUserId);
  }

  return [...keys];
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

    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Unauthorized');
    }
    const userId = identity.subject;
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    const senderParticipantKeys = new Set<string>([userId]);
    if (currentUser?._id) {
      senderParticipantKeys.add(currentUser._id);
    }

    // Participant check via internal query
    const convo = await ctx.runQuery(internal.messages.internalGetConversation, {
      conversationId: args.conversationId,
    });
    if (!convo) {
      throw new ConvexError('Conversation not found');
    }

    const isBuyerByAlias = matchesAnyParticipantId(convo.buyerId, [...senderParticipantKeys]);
    const isSellerByAlias = matchesAnyParticipantId(convo.sellerId, [...senderParticipantKeys]);
    if (!isBuyerByAlias && !isSellerByAlias) {
      throw new ConvexError('Forbidden');
    }

    const senderId = isBuyerByAlias ? convo.buyerId : convo.sellerId;
    const recipientId = isBuyerByAlias ? convo.sellerId : convo.buyerId;

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
    const participantKeys = await getParticipantKeys(ctx);
    const canonicalParticipantKeys = [
      ...new Set(
        participantKeys
          .map((participantKey) => canonicalParticipantId(participantKey).trim())
          .filter((participantKey) => participantKey.length > 0)
      ),
    ];
    const indexedConversationResults = await Promise.all(
      canonicalParticipantKeys.flatMap((participantKey) => [
        ctx.db
          .query('conversations')
          .withIndex('by_buyer', (q) => q.eq('buyerId', participantKey))
          .order('desc')
          .collect(),
        ctx.db
          .query('conversations')
          .withIndex('by_seller', (q) => q.eq('sellerId', participantKey))
          .order('desc')
          .collect(),
        ctx.db
          .query('conversations')
          .withIndex('by_buyer', (q) =>
            q.gte('buyerId', `${participantKey}|`).lt('buyerId', `${participantKey}|\uffff`)
          )
          .collect(),
        ctx.db
          .query('conversations')
          .withIndex('by_seller', (q) =>
            q.gte('sellerId', `${participantKey}|`).lt('sellerId', `${participantKey}|\uffff`)
          )
          .collect(),
      ])
    );

    const dedupedConversationIds = new Set<Id<'conversations'>>();
    for (const batch of indexedConversationResults) {
      for (const conversation of batch) {
        dedupedConversationIds.add(conversation._id);
      }
    }

    const participantConversations = (
      await Promise.all(
        [...dedupedConversationIds].map((conversationId) => ctx.db.get(conversationId))
      )
    )
      .filter((conversation): conversation is Doc<'conversations'> => conversation !== null)
      .filter(
        (conversation) =>
          matchesAnyParticipantId(conversation.buyerId, participantKeys) ||
          matchesAnyParticipantId(conversation.sellerId, participantKeys)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Legacy compatibility: merge sibling threads created with aliased participant IDs.
    const dedupedConversationMap = new Map<string, Doc<'conversations'>[]>();
    for (const conversation of participantConversations) {
      const isBuyer = matchesAnyParticipantId(conversation.buyerId, participantKeys);
      const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
      const dedupeKey = `${conversation.listingId}:${canonicalParticipantId(otherUserId)}`;
      const siblings = dedupedConversationMap.get(dedupeKey);
      if (siblings) {
        siblings.push(conversation);
      } else {
        dedupedConversationMap.set(dedupeKey, [conversation]);
      }
    }

    const groupedConversations = [...dedupedConversationMap.entries()]
      .map(([dedupeKey, siblingConversations]) => {
        const sortedSiblings = [...siblingConversations].sort((a, b) => b.updatedAt - a.updatedAt);
        const primaryConversation = sortedSiblings[0];
        const isBuyer = matchesAnyParticipantId(primaryConversation.buyerId, participantKeys);
        const otherUserId = isBuyer ? primaryConversation.sellerId : primaryConversation.buyerId;
        const canonicalOtherUserId = canonicalParticipantId(otherUserId);
        const mergedUpdatedAt = Math.max(
          ...sortedSiblings.map((conversation) => conversation.updatedAt)
        );

        return {
          dedupeKey,
          primaryConversation,
          siblingConversations: sortedSiblings,
          otherUserId,
          canonicalOtherUserId,
          mergedUpdatedAt,
        };
      })
      .sort((a, b) => b.mergedUpdatedAt - a.mergedUpdatedAt);

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
        canonicalOtherUserIds.map(async (canonicalOtherUserId) => {
          const normalizedOtherUserId = await ctx.db.normalizeId('users', canonicalOtherUserId);
          const otherUserDoc = normalizedOtherUserId
            ? await ctx.db.get(normalizedOtherUserId)
            : null;
          return [canonicalOtherUserId, otherUserDoc] as const;
        })
      ),
      Promise.all(
        canonicalOtherUserIds.map(async (canonicalOtherUserId) => {
          const [exactProfile, aliasProfile] = await Promise.all([
            ctx.db
              .query('profiles')
              .withIndex('by_userId', (q) => q.eq('userId', canonicalOtherUserId))
              .first(),
            ctx.db
              .query('profiles')
              .withIndex('by_userId', (q) =>
                q
                  .gte('userId', `${canonicalOtherUserId}|`)
                  .lt('userId', `${canonicalOtherUserId}|\uffff`)
              )
              .first(),
          ]);
          return [canonicalOtherUserId, exactProfile ?? aliasProfile ?? null] as const;
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
            count +
            unreadMessages.filter((message) =>
              matchesAnyParticipantId(message.recipientId, participantKeys)
            ).length,
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
  const participantKeys = await getParticipantKeys(ctx);
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
    const isBuyer = matchesAnyParticipantId(conversation.buyerId, participantKeys);
    const isSeller = matchesAnyParticipantId(conversation.sellerId, participantKeys);
    if (!isBuyer && !isSeller) {
      throw new ConvexError('Forbidden');
    }

    const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
    return {
      conversation,
      isBuyer,
      isSeller,
      dedupeKey: `${conversation.listingId}:${canonicalParticipantId(otherUserId)}`,
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
    participantKeys,
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

export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerParticipantKeys = await getParticipantKeys(ctx);
    const buyerId = buyerParticipantKeys[0];

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
    if (matchesAnyParticipantId(sellerId, buyerParticipantKeys)) {
      throw new ConvexError("You can't message yourself");
    }

    for (const buyerKey of buyerParticipantKeys) {
      const existing = await ctx.db
        .query('conversations')
        .withIndex('by_listing_buyer_seller', (q) =>
          q.eq('listingId', args.listingId).eq('buyerId', buyerKey)
        )
        .filter((q) => q.eq(q.field('sellerId'), sellerId))
        .first();

      if (existing) return { conversationId: existing._id };
    }

    const listingConversations = await ctx.db
      .query('conversations')
      .withIndex('by_listing', (q) => q.eq('listingId', args.listingId))
      .collect();

    const aliasMatches = listingConversations
      .filter(
        (conversation) =>
          matchesAnyParticipantId(conversation.buyerId, buyerParticipantKeys) &&
          isSameParticipantId(conversation.sellerId, sellerId)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const aliasMatch = aliasMatches[0];
    if (aliasMatch) {
      return { conversationId: aliasMatch._id };
    }

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
    const { conversationScope, participantKeys } = await requireConversationScope(ctx, args);

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
      conversationScope.flatMap(({ conversation }) =>
        participantKeys.map((participantKey) =>
          ctx.db
            .query('messages')
            .withIndex('by_conversation_recipient_readAt', (q) =>
              q
                .eq('conversationId', conversation._id)
                .eq('recipientId', participantKey)
                .eq('readAt', 0)
            )
            .collect()
        )
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

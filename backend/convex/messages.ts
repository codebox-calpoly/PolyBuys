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

function displayNameFromProfile(
  profile: { name?: string; email?: string; userId?: string } | null,
  user: { name?: string; email?: string } | null,
  fallbackUserId: string
) {
  const userName = user?.name?.trim();
  if (userName && userName.length > 0) {
    return userName;
  }

  if (!profile) {
    const userEmail = user?.email?.trim().toLowerCase();
    if (userEmail && userEmail.includes('@')) {
      return userEmail.split('@')[0];
    }

    const normalized = fallbackUserId.trim().toLowerCase();
    if (normalized.includes('@')) {
      return normalized.split('@')[0];
    }
    return 'User';
  }

  const trimmedName = profile.name?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return trimmedName;
  }

  const email = profile.email?.trim().toLowerCase();
  if (email && email.includes('@')) {
    return email.split('@')[0];
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
    // Validate message body length
    if (args.body.length === 0) {
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
  },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.conversationId);

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    return messages;
  },
});

//List all user conversations a user participates in, ordered by most recent activity
export const listUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const participantKeys = await getParticipantKeys(ctx);
    const allConversations = await ctx.db.query('conversations').collect();
    const participantConversations = allConversations
      .filter(
        (conversation) =>
          matchesAnyParticipantId(conversation.buyerId, participantKeys) ||
          matchesAnyParticipantId(conversation.sellerId, participantKeys)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Legacy compatibility: collapse duplicate threads created with aliased participant IDs.
    const dedupedConversationMap = new Map<string, Doc<'conversations'>>();
    for (const conversation of participantConversations) {
      const isBuyer = matchesAnyParticipantId(conversation.buyerId, participantKeys);
      const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
      const dedupeKey = `${conversation.listingId}:${canonicalParticipantId(otherUserId)}`;
      const existing = dedupedConversationMap.get(dedupeKey);
      if (!existing || conversation.updatedAt > existing.updatedAt) {
        dedupedConversationMap.set(dedupeKey, conversation);
      }
    }
    const conversations = [...dedupedConversationMap.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    return await Promise.all(
      conversations.map(async (conversation) => {
        const isBuyer = matchesAnyParticipantId(conversation.buyerId, participantKeys);
        const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;

        const [otherProfile, listing, latestMessage, unreadMessages] = await Promise.all([
          ctx.db
            .query('profiles')
            .withIndex('by_userId', (q) => q.eq('userId', otherUserId))
            .first(),
          ctx.db.get(conversation.listingId),
          ctx.db
            .query('messages')
            .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversation._id))
            .order('desc')
            .first(),
          ctx.db
            .query('messages')
            .withIndex('by_conversation_recipient_readAt', (q) =>
              q.eq('conversationId', conversation._id)
            )
            .filter((q) => q.eq(q.field('readAt'), 0))
            .collect(),
        ]);

        const normalizedOtherUserId = await ctx.db.normalizeId('users', otherUserId);
        const otherUserDoc = normalizedOtherUserId ? await ctx.db.get(normalizedOtherUserId) : null;

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

        return {
          ...conversation,
          otherUser: {
            id: otherUserId,
            name: displayNameFromProfile(otherProfile, otherUserDoc, otherUserId),
          },
          listing: {
            id: conversation.listingId,
            title: listing?.title ?? 'Listing unavailable',
            thumbnailUrl: listingThumbnailUrl ?? null,
          },
          lastMessagePreview: latestMessage?.body ?? 'Conversation started',
          lastMessageAt: latestMessage?.createdAt ?? conversation.updatedAt,
          unreadCount: unreadMessages.filter((message) =>
            matchesAnyParticipantId(message.recipientId, participantKeys)
          ).length,
          hasUnread: unreadMessages.some((message) =>
            matchesAnyParticipantId(message.recipientId, participantKeys)
          ),
        };
      })
    );
  },
});

async function requireParticipant(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>
) {
  const participantKeys = await getParticipantKeys(ctx);
  const userId = participantKeys[0];
  const convo = await ctx.db.get(conversationId);
  if (!convo) throw new ConvexError('Conversation not found');

  const isBuyer = matchesAnyParticipantId(convo.buyerId, participantKeys);
  const isSeller = matchesAnyParticipantId(convo.sellerId, participantKeys);
  if (!isBuyer && !isSeller) throw new ConvexError('Forbidden');

  return { userId, participantKeys, convo, isBuyer, isSeller };
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
  },
  handler: async (ctx, args) => {
    const { convo, participantKeys, isBuyer, isSeller } = await requireParticipant(
      ctx,
      args.conversationId
    );

    const now = Date.now();

    if (isBuyer) {
      await ctx.db.patch(convo._id, { buyerLastReadAt: now, updatedAt: now });
    } else if (isSeller) {
      await ctx.db.patch(convo._id, { sellerLastReadAt: now, updatedAt: now });
    }

    const unread = await ctx.db
      .query('messages')
      .withIndex('by_conversation_recipient_readAt', (q) =>
        q.eq('conversationId', args.conversationId)
      )
      .filter((q) => q.eq(q.field('readAt'), 0))
      .collect();

    for (const msg of unread) {
      if (matchesAnyParticipantId(msg.recipientId, participantKeys)) {
        await ctx.db.patch(msg._id, { readAt: now });
      }
    }

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
  },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.conversationId);

    return await ctx.db
      .query('messages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', args.conversationId))
      .collect();
  },
});

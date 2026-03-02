import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

const MAX_CONVERSATION_HISTORY = 500;
const MAX_USER_CONVERSATIONS = 400;
const MAX_READ_PATCH_BATCH = 1000;

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
  handler: async (ctx, args): Promise<{ messageId: string }> => {
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

    const recipientId = userId === convo.buyerId ? convo.sellerId : convo.buyerId;

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
      senderId: userId,
      recipientId,
      body: args.body,
      type: type,
    });

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
      .take(MAX_CONVERSATION_HISTORY);

    return messages;
  },
});

// List user conversations with pagination + inbox payload
export const listUserConversations = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const cursor = args.cursor ? Number.parseInt(args.cursor, 10) : 0;
    const offset = Number.isNaN(cursor) || cursor < 0 ? 0 : cursor;

    const buyerConvos = await ctx.db
      .query('conversations')
      .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
      .order('desc')
      .take(MAX_USER_CONVERSATIONS);

    const sellerConvos = await ctx.db
      .query('conversations')
      .withIndex('by_seller', (q) => q.eq('sellerId', userId))
      .order('desc')
      .take(MAX_USER_CONVERSATIONS);

    const deduped = new Map([...buyerConvos, ...sellerConvos].map((c) => [c._id, c]));
    const sorted = [...deduped.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_USER_CONVERSATIONS);

    const page = sorted.slice(offset, offset + limit);
    const items = [];

    for (const convo of page) {
      const otherUserId = convo.buyerId === userId ? convo.sellerId : convo.buyerId;
      const profile = await ctx.db
        .query('profiles')
        .withIndex('by_userId', (q) => q.eq('userId', otherUserId))
        .unique();

      let preview = '';
      if (convo.lastMessageId) {
        const last = await ctx.db.get(convo.lastMessageId);
        preview = (last?.body ?? '').slice(0, 140);
      } else {
        const latest = await ctx.db
          .query('messages')
          .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', convo._id))
          .order('desc')
          .take(1);
        preview = (latest[0]?.body ?? '').slice(0, 140);
      }

      const unreadRows = await ctx.db
        .query('messages')
        .withIndex('by_conversation_recipient_readAt', (q) =>
          q.eq('conversationId', convo._id).eq('recipientId', userId).eq('readAt', 0)
        )
        .take(200);

      items.push({
        conversationId: convo._id,
        listingId: convo.listingId,
        lastMessageAt: convo.updatedAt,
        lastMessagePreview: preview,
        unreadCount: unreadRows.length,
        otherParticipant: {
          id: otherUserId,
          name: profile?.name ?? null,
          avatar: profile?.picture ?? null,
        },
      });
    }

    const nextOffset = offset + page.length;
    return {
      items,
      nextCursor: nextOffset < sorted.length ? String(nextOffset) : null,
      total: sorted.length,
    };
  },
});

async function getUserId(ctx: MutationCtx | QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Unauthorized');
  return identity.subject;
}

async function requireParticipant(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>
) {
  const userId = await getUserId(ctx);
  const convo = await ctx.db.get(conversationId);
  if (!convo) throw new ConvexError('Conversation not found');

  const isBuyer = convo.buyerId === userId;
  const isSeller = convo.sellerId === userId;
  if (!isBuyer && !isSeller) throw new ConvexError('Forbidden');

  return { userId, convo, isBuyer, isSeller };
}

export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerId = await getUserId(ctx);

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
    if (buyerId === sellerId) throw new ConvexError("You can't message yourself");

    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', buyerId)
      )
      .filter((q) => q.eq(q.field('sellerId'), sellerId))
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
  },
  handler: async (ctx, args) => {
    const { userId, convo, isBuyer, isSeller } = await requireParticipant(ctx, args.conversationId);

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
      .filter((q) => q.eq(q.field('recipientId'), userId))
      .filter((q) => q.eq(q.field('readAt'), 0))
      .take(MAX_READ_PATCH_BATCH);

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { readAt: now });
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
      .take(MAX_CONVERSATION_HISTORY);
  },
});

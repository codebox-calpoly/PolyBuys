import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

//Sends a message and updates conversation metadata
export const sendMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    senderId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const recipientId =
      args.senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;

    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      listingId: conversation.listingId,
      senderId: args.senderId,
      recipientId,
      body: args.body,
      createdAt: now,
      readAt: 0,
    });

    await ctx.db.patch(conversation._id, {
      updatedAt: now,
    });

    return { messageId };
  },
});

//Debug helper for local testing
export const debugCreateConversationID = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const conversationId = await ctx.db.insert('conversations', {
      listingId: 'debug-listing-id' as any,
      buyerId: 'buyer@test.com',
      sellerId: 'seller@test.com',
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
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const buyerConvos = await ctx.db
      .query('conversations')
      .withIndex('by_buyer', (q) => q.eq('buyerId', args.userId))
      .order('desc')
      .collect();

    const sellerConvos = await ctx.db
      .query('conversations')
      .withIndex('by_seller', (q) => q.eq('sellerId', args.userId))
      .order('desc')
      .collect();

    return [...buyerConvos, ...sellerConvos].sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

async function getUserId(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  return identity.subject;
}

async function requireParticipant(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>
) {
  const userId = await getUserId(ctx);
  const convo = await ctx.db.get(conversationId);
  if (!convo) throw new Error('Conversation not found');

  const isBuyer = convo.buyerId === userId;
  const isSeller = convo.sellerId === userId;
  if (!isBuyer && !isSeller) throw new Error('Forbidden');

  return { userId, convo, isBuyer, isSeller };
}

// TASK: associate conversations with specific listings
export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerId = await getUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error('Listing not found');

    const sellerId = listing.sellerId;
    if (buyerId === sellerId) throw new Error("You can't message yourself");

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
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { readAt: now });
    }

    return { ok: true };
  },
});

// TASK: real-time message delivery (Convex query is reactive when used with useQuery)
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

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const sendMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    senderId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: args.senderId,
      body: args.body,
      type: 'text',
      createdAt: now,
      read: false,
    });
  },
});

// Export handler separately for testing
export const listUserConversationsHandler = async (ctx: any, args: any) => {
  // Step 1: Get userId from auth context
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Unauthorized');
  }
  const userId = identity.subject;

  // Step 2: Query conversations, filter by participant
  const allConversations = await ctx.db.query('conversations').collect();
  const conversations = allConversations
    .filter((conv: any) => conv.participantIds.includes(userId))
    .sort((a: any, b: any) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt))
    .slice(0, args.limit || 20);
  // Step 3: For each conversation:
  const conversationList = [];
  for (const conv of conversations) {
    //   - Calculate otherUserId
    const otherUserId = userId === conv.buyerId ? conv.sellerId : conv.buyerId;

    //   - Get lastMessagePreview
    const lastMsg = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q: any) => q.eq('conversationId', conv._id))
      .order('desc')
      .first();

    //   - Calculate unreadCount
    const allMessages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q: any) => q.eq('conversationId', conv._id))
      .collect();

    const unreadCount = allMessages.filter(
      (msg: any) => msg.senderId !== userId && !msg.read
    ).length;

    //   - Build response object
    conversationList.push({
      conversationId: conv._id,
      listingId: conv.listingId,
      otherUserId,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: lastMsg?.body || 'No messages yet',
      unreadCount,
      createdAt: conv.createdAt,
    });
  }

  // Step 4: Sort and paginate
  conversationList.sort(
    (a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt)
  );
  return {
    conversations: conversationList,
    nextCursor: null,
  };
};

export const listUserConversations = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()), // lastMessageAt value from previous page
  },
  handler: listUserConversationsHandler,
});

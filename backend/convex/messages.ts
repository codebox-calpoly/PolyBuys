import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

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

    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: args.senderId,
      body: args.body,
      type: 'text',
      createdAt: now,
      read: false,
    });

    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      updatedAt: now,
      lastMessageId: messageId,
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
      participantIds: ['buyer@test.com', 'seller@test.com'],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
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
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
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
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect();

    const myConversations = conversations.filter((c) => c.participantIds.includes(args.userId));

    return myConversations;
  },
});

import { mutation } from './_generated/server';
import { v } from 'convex/values';

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
  },
});

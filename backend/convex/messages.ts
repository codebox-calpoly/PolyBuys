import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const sendMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const senderId = identity.subject;

    // Fetch the conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify the authenticated user is a participant
    if (!conversation.participantIds.includes(senderId)) {
      throw new Error('User is not a participant in this conversation');
    }

    const now = Date.now();

    // Insert the message
    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      senderId: senderId,
      body: args.body,
      type: 'text',
      createdAt: now,
      read: false,
    });

    // Update the conversation's metadata
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageId: messageId,
      updatedAt: now,
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
  const limit = args.limit || 20;
  const allConversations = await ctx.db.query('conversations').collect();
  let conversations = allConversations
    .filter((conv: any) => conv.participantIds.includes(userId))
    .sort((a: any, b: any) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));

  // Apply cursor filtering if provided
  if (args.cursor) {
    const cursorValue = parseInt(args.cursor, 10);
    conversations = conversations.filter(
      (conv: any) => (conv.lastMessageAt || conv.createdAt) < cursorValue
    );
  }

  // Fetch limit + 1 to detect if there are more results
  conversations = conversations.slice(0, limit + 1);

  // Step 3: For each conversation (up to limit):
  const conversationList = [];
  const displayedConversations = conversations.slice(0, limit);

  for (const conv of displayedConversations) {
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

  // Step 4: Determine nextCursor
  let nextCursor = null;
  if (conversations.length > limit && displayedConversations.length > 0) {
    const lastConv = displayedConversations[displayedConversations.length - 1];
    nextCursor = String(lastConv.lastMessageAt || lastConv.createdAt);
  }

  return {
    conversations: conversationList,
    nextCursor,
  };
};

export const listUserConversations = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()), // lastMessageAt value from previous page
  },
  handler: listUserConversationsHandler,
});

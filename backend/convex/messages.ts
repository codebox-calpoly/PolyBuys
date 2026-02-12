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

    // Keep participant lookup rows in sync for server-side indexed conversation queries.
    const participantRows = await ctx.db
      .query('conversationParticipants')
      .withIndex('by_conversationId', (q: any) => q.eq('conversationId', args.conversationId))
      .collect();

    const participantRowByUserId = new Map(participantRows.map((row: any) => [row.userId, row]));

    for (const participantId of conversation.participantIds) {
      const existingRow = participantRowByUserId.get(participantId);
      if (existingRow) {
        await ctx.db.patch(existingRow._id, {
          lastActivityAt: now,
          unreadCount:
            participantId === senderId
              ? (existingRow.unreadCount ?? 0)
              : (existingRow.unreadCount ?? 0) + 1,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert('conversationParticipants', {
          conversationId: args.conversationId,
          userId: participantId,
          lastActivityAt: now,
          unreadCount: participantId === senderId ? 0 : 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
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

  // Step 2: Query participant rows by indexed userId + activity timestamp.
  const limit = args.limit || 20;
  let cursorValue: number | undefined;
  if (args.cursor) {
    const parsedCursor = Number.parseInt(args.cursor, 10);
    if (!Number.isNaN(parsedCursor)) {
      cursorValue = parsedCursor;
    }
  }
  const participantRows = await ctx.db
    .query('conversationParticipants')
    .withIndex('by_user_lastActivityAt', (q: any) =>
      cursorValue === undefined
        ? q.eq('userId', userId)
        : q.eq('userId', userId).lt('lastActivityAt', cursorValue)
    )
    .order('desc')
    .take(limit + 1);

  // Step 3: For each conversation (up to limit):
  const conversationList = [];
  const displayedParticipantRows = participantRows.slice(0, limit);
  const displayedConversations = (
    await Promise.all(
      displayedParticipantRows.map(async (participantRow: any) => ({
        participantRow,
        conversation: await ctx.db.get(participantRow.conversationId),
      }))
    )
  ).filter((row: any) => row.conversation !== null);

  const lastMessageByConversationId = new Map();
  await Promise.all(
    displayedConversations.map(async ({ conversation }: any) => {
      if (!conversation.lastMessageId) {
        return;
      }
      const lastMessage = await ctx.db.get(conversation.lastMessageId);
      if (lastMessage) {
        lastMessageByConversationId.set(conversation._id, lastMessage);
      }
    })
  );

  for (const { participantRow, conversation: conv } of displayedConversations) {
    //   - Calculate otherUserId
    const otherUserId = userId === conv.buyerId ? conv.sellerId : conv.buyerId;

    //   - Get lastMessagePreview
    const lastMsg = lastMessageByConversationId.get(conv._id);

    //   - Calculate unreadCount
    const unreadCount = participantRow.unreadCount ?? 0;

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
  if (participantRows.length > limit && displayedParticipantRows.length > 0) {
    const lastParticipantRow = displayedParticipantRows[displayedParticipantRows.length - 1];
    nextCursor = String(lastParticipantRow.lastActivityAt);
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

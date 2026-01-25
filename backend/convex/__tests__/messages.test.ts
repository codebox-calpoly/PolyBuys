import { listUserConversationsHandler } from '../messages';

describe('listUserConversations', () => {
  it('returns empty list for user with no conversations', async () => {
    // 1. Mock ctx with empty database
    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: 'user_123' }),
      },
      db: {
        query: () => ({
          collect: async () => [], // No conversations
        }),
      },
    };

    // 2. Call the handler
    const result = await listUserConversationsHandler(ctx, {});

    // 3. Assert
    expect(result.conversations).toEqual([]);
  });

  it('filters out conversations where user is not a participant', async () => {
    const userId = 'user_123';

    // Mock conversations - only one includes our userId
    const mockConversations = [
      {
        _id: 'conv_1',
        buyerId: 'user_456',
        sellerId: 'user_789',
        participantIds: ['user_456', 'user_789'],
        lastMessageAt: 1000,
        createdAt: 1000,
        listingId: 'listing_1',
      },
      {
        _id: 'conv_2',
        buyerId: userId,
        sellerId: 'user_999',
        participantIds: [userId, 'user_999'],
        lastMessageAt: 2000,
        createdAt: 1500,
        listingId: 'listing_2',
      },
    ];

    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: userId }),
      },
      db: {
        query: (table: any) => {
          if (table === 'conversations') {
            return {
              collect: async () => mockConversations,
            };
          }
          // For messages queries
          return {
            withIndex: () => ({
              order: () => ({ first: async () => null }),
              collect: async () => [],
            }),
          };
        },
      },
    };

    const result = await listUserConversationsHandler(ctx, {});

    // Should only return conv_2 (where userId is a participant)
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].conversationId).toBe('conv_2');
  });

  it('throws Unauthorized when no auth identity', async () => {
    const ctx = {
      auth: {
        getUserIdentity: async () => null, // Not authenticated
      },
      db: { query: () => ({ collect: async () => [] }) },
    };

    await expect(listUserConversationsHandler(ctx, {})).rejects.toThrow('Unauthorized');
  });

  it('calculates unread count correctly', async () => {
    const userId = 'user_123';

    const mockConversations = [
      {
        _id: 'conv_1',
        buyerId: userId,
        sellerId: 'user_999',
        participantIds: [userId, 'user_999'],
        lastMessageAt: 2000,
        createdAt: 1500,
        listingId: 'listing_2',
      },
    ];

    const mockMessages = [
      { senderId: 'user_999', body: 'Hi there', read: false }, // unread, from other
      { senderId: 'user_999', body: 'How are you?', read: true }, // read
      { senderId: userId, body: 'Good!', read: false }, // unread but from me (don't count)
    ];

    const ctx = {
      auth: {
        getUserIdentity: async () => ({ subject: userId }),
      },
      db: {
        query: (table: any) => {
          if (table === 'conversations') {
            return { collect: async () => mockConversations };
          }
          // For messages
          return {
            withIndex: () => ({
              order: () => ({ first: async () => mockMessages[0] }), // lastMsg
              collect: async () => mockMessages,
            }),
          };
        },
      },
    };

    const result = await listUserConversationsHandler(ctx, {});

    // Only 1 unread (first message: from user_999, read: false)
    expect(result.conversations[0].unreadCount).toBe(1);
  });
});

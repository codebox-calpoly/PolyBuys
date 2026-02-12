import { listUserConversationsHandler } from '../messages';

function buildCtx({
  userId,
  participantRows,
  docsById,
}: {
  userId: string | null;
  participantRows?: any[];
  docsById?: Record<string, any>;
}) {
  return {
    auth: {
      getUserIdentity: async () => (userId ? { subject: userId } : null),
    },
    db: {
      get: async (id: string) => docsById?.[id] ?? null,
      query: (table: any) => {
        if (table === 'conversationParticipants') {
          return {
            withIndex: (_index: string, filterBuilder: any) => {
              const state: { requestedUserId?: string; cursor?: number } = {};
              filterBuilder({
                eq: (_field: string, value: string) => {
                  state.requestedUserId = value;
                  return {
                    lt: (_ltField: string, ltValue: number) => {
                      state.cursor = ltValue;
                      return null;
                    },
                  };
                },
              });

              const filtered = (participantRows ?? [])
                .filter((row: any) => row.userId === state.requestedUserId)
                .filter(
                  (row: any) => state.cursor === undefined || row.lastActivityAt < state.cursor
                )
                .sort((a: any, b: any) => b.lastActivityAt - a.lastActivityAt);

              return {
                order: () => ({
                  take: async (count: number) => filtered.slice(0, count),
                }),
              };
            },
          };
        }

        throw new Error(`Unexpected query table: ${table}`);
      },
    },
  };
}

describe('listUserConversations', () => {
  it('returns empty list for user with no conversations', async () => {
    const ctx = buildCtx({
      userId: 'user_123',
      participantRows: [],
    });

    const result = await listUserConversationsHandler(ctx, {});

    expect(result.conversations).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('returns only conversations for the authenticated user', async () => {
    const userId = 'user_123';
    const ctx = buildCtx({
      userId,
      participantRows: [
        { conversationId: 'conv_2', userId, lastActivityAt: 2000, unreadCount: 0 },
        { conversationId: 'conv_1', userId: 'other_user', lastActivityAt: 3000 },
      ],
      docsById: {
        conv_2: {
          _id: 'conv_2',
          buyerId: userId,
          sellerId: 'user_999',
          lastMessageAt: 2000,
          createdAt: 1500,
          listingId: 'listing_2',
        },
      },
    });

    const result = await listUserConversationsHandler(ctx, {});

    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].conversationId).toBe('conv_2');
  });

  it('throws Unauthorized when no auth identity', async () => {
    const ctx = buildCtx({
      userId: null,
      participantRows: [],
    });

    await expect(listUserConversationsHandler(ctx, {})).rejects.toThrow('Unauthorized');
  });

  it('calculates unread count correctly', async () => {
    const userId = 'user_123';

    const ctx = buildCtx({
      userId,
      participantRows: [{ conversationId: 'conv_1', userId, lastActivityAt: 2000, unreadCount: 1 }],
      docsById: {
        conv_1: {
          _id: 'conv_1',
          buyerId: userId,
          sellerId: 'user_999',
          lastMessageAt: 2000,
          lastMessageId: 'msg_1',
          createdAt: 1500,
          listingId: 'listing_2',
        },
        msg_1: {
          _id: 'msg_1',
          senderId: 'user_999',
          body: 'Hi there',
          read: false,
          createdAt: 2000,
        },
      },
    });

    const result = await listUserConversationsHandler(ctx, {});

    expect(result.conversations[0].unreadCount).toBe(1);
  });
});

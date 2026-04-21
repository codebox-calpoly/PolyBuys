jest.mock('@convex-dev/expo-push-notifications', () => {
  const sendPushNotificationMock = jest.fn().mockResolvedValue('push-id');
  return {
    __private: { sendPushNotificationMock },
    PushNotifications: jest.fn().mockImplementation(() => ({
      recordToken: jest.fn().mockResolvedValue(null),
      removeToken: jest.fn().mockResolvedValue(null),
      sendPushNotification: sendPushNotificationMock,
    })),
  };
});

import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import {
  createConvexTest,
  createTestProfile,
  createTestUser,
  createTestListing,
  createTestConversation,
  createTestConversationEmpty,
} from './testUtils';

function getSendPushNotificationMock(): jest.Mock {
  return (
    jest.requireMock('@convex-dev/expo-push-notifications') as {
      __private: { sendPushNotificationMock: jest.Mock };
    }
  ).__private.sendPushNotificationMock;
}

type ConvexTestInstance = ReturnType<typeof createConvexTest>;

const MESSAGE_SEED_START = 1_700_000_000_000;

function buildModerationFetchResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    }),
  } as Response;
}

async function seedConversationMessages(
  t: ConvexTestInstance,
  {
    conversationId,
    listingId,
    buyerId,
    sellerId,
    bodies,
    startAt = MESSAGE_SEED_START,
  }: {
    conversationId: Id<'conversations'>;
    listingId: Id<'listings'>;
    buyerId: Id<'users'>;
    sellerId: Id<'users'>;
    bodies: string[];
    startAt?: number;
  }
) {
  await t.run(async (ctx) => {
    for (const [index, body] of bodies.entries()) {
      const senderId = index % 2 === 0 ? buyerId : sellerId;
      const recipientId = index % 2 === 0 ? sellerId : buyerId;
      await ctx.db.insert('messages', {
        conversationId,
        listingId,
        senderId,
        recipientId,
        type: 'text',
        body,
        createdAt: startAt + index,
        readAt: 0,
      });
    }
  });
}

// Mock global fetch for OpenAI Moderation API calls
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(buildModerationFetchResponse()) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  getSendPushNotificationMock().mockClear();
});

describe('Messages queries and mutations', () => {
  describe('sendMessage', () => {
    it('throws error when user is not a participant', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const other = await createTestUser(t, 'other@calpoly.edu', 'Other');

      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asOther = t.withIdentity(other.identity);

      await expect(
        asOther.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        })
      ).rejects.toThrow('Forbidden');
    });

    it('rejects whitespace-only message bodies', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await expect(
        asBuyer.action(api.messages.sendMessage, {
          conversationId,
          body: '   \n\t  ',
        })
      ).rejects.toThrow('Message cannot be empty');
    });

    it('successfully sends message from buyer to seller', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      const result = await asBuyer.action(api.messages.sendMessage, {
        conversationId,
        body: 'Hello seller!',
      });

      expect(result.messageId).toBeDefined();

      const message = await t.run(async (ctx) => await ctx.db.get(result.messageId));

      expect(message).toMatchObject({
        conversationId,
        listingId,
        senderId: buyer.id,
        recipientId: seller.id,
        body: 'Hello seller!',
        readAt: 0,
      });
    });

    it('successfully sends message from seller to buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);

      const result = await asSeller.action(api.messages.sendMessage, {
        conversationId,
        body: 'Hello buyer!',
      });

      const message = await t.run(async (ctx) => await ctx.db.get(result.messageId));

      expect(message?.senderId).toBe(seller.id);
      expect(message?.recipientId).toBe(buyer.id);
    });

    it('updates conversation updatedAt timestamp', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          updatedAt: 1,
        });
      });

      await asBuyer.action(api.messages.sendMessage, {
        conversationId,
        body: 'Test message',
      });

      const conversationAfter = await t.run(async (ctx) => await ctx.db.get(conversationId));

      expect(conversationAfter!.updatedAt).toBeGreaterThan(1);
    });

    it('sends a push notification to the recipient when a new message is created', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.action(api.messages.sendMessage, {
        conversationId,
        body: 'Push me when you get this',
      });

      const mockCall = getSendPushNotificationMock().mock.calls[0];
      expect(mockCall[1]).toMatchObject({
        userId: seller.id,
        allowUnregisteredTokens: true,
        notification: expect.objectContaining({
          body: 'Push me when you get this',
          data: expect.objectContaining({
            conversationId,
            listingId,
            senderId: buyer.id,
            senderName: expect.any(String),
          }),
        }),
      });
      expect(mockCall[1].notification.title).toBeDefined();
      expect(typeof mockCall[1].notification.title).toBe('string');
    });
  });

  describe('block checks', () => {
    it('sendMessage throws when sender has blocked recipient', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.blocks.blockUser, { blockedId: seller.id });
      await expect(
        asBuyer.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        })
      ).rejects.toThrow('You cannot message this user');
    });

    it('sendMessage throws when recipient has blocked sender', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      await asSeller.mutation(api.blocks.blockUser, { blockedId: buyer.id });
      await expect(
        asSeller.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        })
      ).rejects.toThrow('You cannot message this user');
    });
  });

  describe('getConversationHistory', () => {
    it('throws error when user is not a participant', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const other = await createTestUser(t, 'other@calpoly.edu', 'Other');

      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asOther = t.withIdentity(other.identity);

      await expect(
        asOther.query(api.messages.getConversationHistory, {
          conversationId,
        })
      ).rejects.toThrow('Forbidden');
    });

    it('returns empty array when no messages exist', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      const messages = await asBuyer.query(api.messages.getConversationHistory, {
        conversationId,
      });

      expect(messages).toEqual([]);
    });

    it('returns messages in chronological order', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      // Insert messages directly
      await t.run(async (ctx) => {
        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'First message',
          createdAt: Date.now(),
          readAt: 0,
        });

        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: seller.id,
          recipientId: buyer.id,
          type: 'text',
          body: 'Second message',
          createdAt: Date.now() + 1000,
          readAt: 0,
        });

        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'Third message',
          createdAt: Date.now() + 2000,
          readAt: 0,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const messages = await asBuyer.query(api.messages.getConversationHistory, {
        conversationId,
      });

      expect(messages).toHaveLength(3);
      expect(messages[0].body).toBe('First message');
      expect(messages[1].body).toBe('Second message');
      expect(messages[2].body).toBe('Third message');
    });

    it('returns only the latest bounded history when a limit is provided', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await seedConversationMessages(t, {
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        bodies: ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'],
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const messages = await asBuyer.query(api.messages.getConversationHistory, {
        conversationId,
        limit: 3,
      });

      expect(messages.map((message) => message.body)).toEqual([
        'Message 3',
        'Message 4',
        'Message 5',
      ]);
    });
  });

  describe('listUserConversations', () => {
    it('throws error when user is not authenticated', async () => {
      const t = createConvexTest();

      await expect(t.query(api.messages.listUserConversations)).rejects.toThrow('Unauthorized');
    });

    it('returns empty array when user has no conversations', async () => {
      const t = createConvexTest();
      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const asBuyer = t.withIdentity(buyer.identity);

      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations).toEqual([]);
    });

    it('returns conversations where user is buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].buyerId).toBe(buyer.id);
    });

    it('returns conversations where user is seller', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      const conversations = await asSeller.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].sellerId).toBe(seller.id);
    });

    it('returns conversations sorted by most recent activity', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');

      const listingId1 = await createTestListing(t, seller.id, { title: 'Listing 1' });
      const listingId2 = await createTestListing(t, seller.id, { title: 'Listing 2' });

      // Create older conversation with message
      await t.run(async (ctx) => {
        const now = Date.now();
        const convId1 = await ctx.db.insert('conversations', {
          listingId: listingId1,
          buyerId: buyer.id,
          sellerId: seller.id,
          participantIds: [buyer.id, seller.id],
          createdAt: now - 2000,
          updatedAt: now - 2000,
          buyerLastReadAt: now,
          sellerLastReadAt: now,
        });
        const msgId1 = await ctx.db.insert('messages', {
          conversationId: convId1,
          listingId: listingId1,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'Hi',
          createdAt: now - 2000,
          readAt: 0,
        });
        await ctx.db.patch(convId1, { lastMessageId: msgId1 });
      });

      // Create newer conversation with message
      await t.run(async (ctx) => {
        const now = Date.now();
        const convId2 = await ctx.db.insert('conversations', {
          listingId: listingId2,
          buyerId: buyer.id,
          sellerId: seller.id,
          participantIds: [buyer.id, seller.id],
          createdAt: now - 1000,
          updatedAt: now - 1000,
          buyerLastReadAt: now,
          sellerLastReadAt: now,
        });
        const msgId2 = await ctx.db.insert('messages', {
          conversationId: convId2,
          listingId: listingId2,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'Hi',
          createdAt: now - 1000,
          readAt: 0,
        });
        await ctx.db.patch(convId2, { lastMessageId: msgId2 });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(2);
      expect(conversations[0].updatedAt).toBeGreaterThan(conversations[1].updatedAt);
    });

    it('resolves other user name from profile', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      await t.run(async (ctx) => {
        await ctx.db.patch(buyer.id, { name: '' });
      });
      await createTestProfile(t, buyer.id, {
        name: 'Buyer Profile Name',
        email: 'buyer@calpoly.edu',
      });

      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      const conversations = await asSeller.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].otherUser.name).toBe('Buyer Profile Name');
    });

    it('does not return conversations with no messages', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert('conversations', {
          listingId,
          buyerId: buyer.id,
          sellerId: seller.id,
          participantIds: [buyer.id, seller.id],
          createdAt: now,
          updatedAt: now,
          buyerLastReadAt: now,
          sellerLastReadAt: now,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(0);
    });

    it('returns generic user label when no public name is available', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      await t.run(async (ctx) => {
        await ctx.db.patch(buyer.id, { name: '' });
      });
      await createTestProfile(t, buyer.id, {
        name: '',
        email: 'private-buyer@calpoly.edu',
      });
      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      const conversations = await asSeller.query(api.messages.listUserConversations);

      expect(conversations).toHaveLength(1);
      expect(conversations[0].otherUser.name).toBe('User');
    });

    it('returns stored unread counts without re-scanning the whole inbox', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          buyerUnreadCount: 2,
          sellerUnreadCount: 5,
          lastMessagePreview: 'Latest preview',
          lastMessageAt: Date.now(),
        });
      });

      const asSeller = t.withIdentity(seller.identity);
      const conversations = await asSeller.query(api.messages.listUserConversations, { limit: 10 });

      expect(conversations).toHaveLength(1);
      expect(conversations[0].unreadCount).toBe(5);
      expect(conversations[0].lastMessagePreview).toBe('Latest preview');
    });

    it('caps the inbox response to the requested limit', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');

      for (let index = 0; index < 3; index += 1) {
        const listingId = await createTestListing(t, seller.id, { title: `Listing ${index + 1}` });
        await createTestConversation(t, listingId, buyer.id, seller.id);
      }

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations, { limit: 2 });

      expect(conversations).toHaveLength(2);
    });
  });

  describe('hideConversationFromInbox', () => {
    it('hides the conversation for the caller but not the other participant', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      await asBuyer.mutation(api.messages.hideConversationFromInbox, {
        conversationId,
      });

      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      const sellerConversations = await asSeller.query(api.messages.listUserConversations);

      expect(buyerConversations).toHaveLength(0);
      expect(sellerConversations).toHaveLength(1);
      expect(sellerConversations[0]._id).toBe(conversationId);
    });

    it('shows the conversation again when a new incoming message is received', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      await asBuyer.mutation(api.messages.hideConversationFromInbox, {
        conversationId,
      });
      expect(await asBuyer.query(api.messages.listUserConversations)).toHaveLength(0);

      await asSeller.action(api.messages.sendMessage, {
        conversationId,
        body: 'Still available?',
      });

      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      expect(buyerConversations).toHaveLength(1);
      expect(buyerConversations[0]._id).toBe(conversationId);
      expect(buyerConversations[0].lastMessagePreview).toBe('Still available?');
    });

    it('shows the conversation again when the hidden participant sends a new message', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      await asBuyer.mutation(api.messages.hideConversationFromInbox, {
        conversationId,
      });
      expect(await asBuyer.query(api.messages.listUserConversations)).toHaveLength(0);

      await asBuyer.action(api.messages.createConversationAndSendFirstMessage, {
        listingId,
        body: 'I am interested again.',
      });

      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      expect(buyerConversations).toHaveLength(1);
      expect(buyerConversations[0]._id).toBe(conversationId);
      expect(buyerConversations[0].lastMessagePreview).toBe('I am interested again.');
    });

    it('does not overwrite a reported hidden reason when hideConversationFromInbox is called', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      await asBuyer.mutation(api.messages.reportConversation, {
        conversationId,
        reason: 'spam',
      });

      await asBuyer.mutation(api.messages.hideConversationFromInbox, {
        conversationId,
      });

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      expect(conversation?.buyerInboxHiddenReason).toBe('reported');

      await asSeller.action(api.messages.sendMessage, {
        conversationId,
        body: 'New message after report',
      });

      expect(await asBuyer.query(api.messages.listUserConversations)).toHaveLength(0);
    });
  });

  describe('deleteMessage', () => {
    it('allows deleting your own message and restores the previous lastMessageId', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);
      const asBuyer = t.withIdentity(buyer.identity);

      const conversationBeforeSend = await t.run(async (ctx) => ctx.db.get(conversationId));
      const originalLastMessageId = conversationBeforeSend?.lastMessageId;
      expect(originalLastMessageId).toBeDefined();

      const sent = await asBuyer.action(api.messages.sendMessage, {
        conversationId,
        body: 'This message should be deleted.',
      });

      await asBuyer.mutation(api.messages.deleteMessage, {
        messageId: sent.messageId,
      });

      const deletedMessage = await t.run(async (ctx) => ctx.db.get(sent.messageId));
      const conversationAfterDelete = await t.run(async (ctx) => ctx.db.get(conversationId));

      expect(deletedMessage).toBeNull();
      expect(conversationAfterDelete?.lastMessageId).toBe(originalLastMessageId);
    });

    it('rejects deleting the other participant message', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);
      const asSeller = t.withIdentity(seller.identity);

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      const buyerMessageId = conversation?.lastMessageId;
      expect(buyerMessageId).toBeDefined();
      if (!buyerMessageId) {
        throw new Error('Expected seeded conversation to have a last message');
      }

      await expect(
        asSeller.mutation(api.messages.deleteMessage, {
          messageId: buyerMessageId,
        })
      ).rejects.toThrow('You can only delete your own messages');
    });
  });

  describe('reportMessage', () => {
    it('creates a report for a specific message and hides the conversation for the reporter', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);
      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      const messageId = conversation?.lastMessageId;
      expect(messageId).toBeDefined();
      if (!messageId) {
        throw new Error('Expected seeded conversation to have a last message');
      }

      const { reportId } = await asSeller.mutation(api.messages.reportMessage, {
        messageId,
        reason: 'spam',
      });

      const report = await t.run(async (ctx) => ctx.db.get(reportId));
      expect(report).toMatchObject({
        targetId: messageId,
        targetType: 'message',
        reporterId: seller.id,
        reason: 'spam',
      });

      const sellerConversations = await asSeller.query(api.messages.listUserConversations);
      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      expect(sellerConversations).toHaveLength(0);
      expect(buyerConversations).toHaveLength(1);
    });

    it('rejects duplicate reports from the same user for the same message', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);
      const asSeller = t.withIdentity(seller.identity);

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      const messageId = conversation?.lastMessageId;
      expect(messageId).toBeDefined();
      if (!messageId) {
        throw new Error('Expected seeded conversation to have a last message');
      }

      await asSeller.mutation(api.messages.reportMessage, {
        messageId,
        reason: 'inappropriate',
      });

      await expect(
        asSeller.mutation(api.messages.reportMessage, {
          messageId,
          reason: 'spam',
        })
      ).rejects.toThrow('You have already reported this message');
    });

    it('rejects reporting your own message', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);
      const asBuyer = t.withIdentity(buyer.identity);

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      const messageId = conversation?.lastMessageId;
      expect(messageId).toBeDefined();
      if (!messageId) {
        throw new Error('Expected seeded conversation to have a last message');
      }

      await expect(
        asBuyer.mutation(api.messages.reportMessage, {
          messageId,
          reason: 'spam',
        })
      ).rejects.toThrow('You can only report messages from the other participant');
    });
  });

  describe('reportConversation', () => {
    it('creates a conversation report and hides the thread for the reporter', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);
      const { reportId } = await asBuyer.mutation(api.messages.reportConversation, {
        conversationId,
        reason: 'spam',
      });

      const report = await t.run(async (ctx) => ctx.db.get(reportId));
      expect(report).toMatchObject({
        targetId: conversationId,
        targetType: 'conversation',
        reporterId: buyer.id,
        reason: 'spam',
      });

      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      const sellerConversations = await asSeller.query(api.messages.listUserConversations);
      expect(buyerConversations).toHaveLength(0);
      expect(sellerConversations).toHaveLength(1);
    });

    it('rejects duplicate reports from the same user for the same conversation', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      await asBuyer.mutation(api.messages.reportConversation, {
        conversationId,
        reason: 'spam',
      });

      await expect(
        asBuyer.mutation(api.messages.reportConversation, {
          conversationId,
          reason: 'scam',
        })
      ).rejects.toThrow('You have already reported this conversation');
    });

    it('keeps the conversation hidden after report when new messages arrive', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      await asBuyer.mutation(api.messages.reportConversation, {
        conversationId,
        reason: 'inappropriate',
      });
      expect(await asBuyer.query(api.messages.listUserConversations)).toHaveLength(0);

      await asSeller.action(api.messages.sendMessage, {
        conversationId,
        body: 'Following up on this.',
      });

      const buyerConversations = await asBuyer.query(api.messages.listUserConversations);
      expect(buyerConversations).toHaveLength(0);
    });
  });

  describe('getReportedConversationListingIds', () => {
    it('returns listing IDs tied to conversations reported by the current user', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const sellerTwo = await createTestUser(t, 'seller-two@calpoly.edu', 'Seller Two');
      const listingOneId = await createTestListing(t, seller.id);
      const listingTwoId = await createTestListing(t, sellerTwo.id);
      const conversationOneId = await createTestConversation(t, listingOneId, buyer.id, seller.id);
      const conversationTwoId = await createTestConversation(
        t,
        listingTwoId,
        buyer.id,
        sellerTwo.id
      );

      const asBuyer = t.withIdentity(buyer.identity);
      const asSeller = t.withIdentity(seller.identity);

      await asBuyer.mutation(api.messages.reportConversation, {
        conversationId: conversationOneId,
        reason: 'spam',
      });

      const buyerHiddenListingIds = await asBuyer.query(
        api.messages.getReportedConversationListingIds
      );
      const sellerHiddenListingIds = await asSeller.query(
        api.messages.getReportedConversationListingIds
      );

      expect(buyerHiddenListingIds).toHaveLength(1);
      expect(buyerHiddenListingIds[0]).toBe(listingOneId);
      expect(sellerHiddenListingIds).toHaveLength(0);

      await asBuyer.mutation(api.messages.reportConversation, {
        conversationId: conversationTwoId,
        reason: 'inappropriate',
      });

      const buyerHiddenListingIdsAfterSecondReport = await asBuyer.query(
        api.messages.getReportedConversationListingIds
      );
      expect(new Set(buyerHiddenListingIdsAfterSecondReport)).toEqual(
        new Set([listingOneId, listingTwoId])
      );
    });
  });

  describe('getOrCreateConversation', () => {
    it('throws error when user tries to message themselves', async () => {
      const t = createConvexTest();
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asSeller = t.withIdentity(seller.identity);

      await expect(
        asSeller.mutation(api.messages.getOrCreateConversation, {
          listingId,
        })
      ).rejects.toThrow("You can't message yourself");
    });

    it('creates new conversation when none exists', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      const result = await asBuyer.mutation(api.messages.getOrCreateConversation, {
        listingId,
      });

      expect(result.conversationId).toBeDefined();

      const conversation = await t.run(async (ctx) => {
        return await ctx.db.get(result.conversationId);
      });

      expect(conversation).toMatchObject({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });
    });

    it('returns existing conversation when one already exists', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const existingConversationId = await createTestConversation(
        t,
        listingId,
        buyer.id,
        seller.id
      );

      const asBuyer = t.withIdentity(buyer.identity);

      const result = await asBuyer.mutation(api.messages.getOrCreateConversation, {
        listingId,
      });

      expect(result.conversationId).toBe(existingConversationId);
    });

    it('throws error when listing is not active', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id, { status: 'sold' });

      const asBuyer = t.withIdentity(buyer.identity);

      await expect(
        asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        })
      ).rejects.toThrow('Listing is not active');
    });

    it('throws error when buyer has blocked seller', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.blocks.blockUser, { blockedId: seller.id });

      await expect(
        asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        })
      ).rejects.toThrow('You cannot message this user');
    });

    it('throws error when seller has blocked buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      await asSeller.mutation(api.blocks.blockUser, { blockedId: buyer.id });

      const asBuyer = t.withIdentity(buyer.identity);
      await expect(
        asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        })
      ).rejects.toThrow('You cannot message this user');
    });

    it('throws error when listing is hidden', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');

      // Create listing and manually mark it as hidden
      const listingId = await t.run(async (ctx) => {
        return await ctx.db.insert('listings', {
          sellerId: seller.id,
          title: 'Hidden Listing',
          description: 'Test description',
          price: 100,
          category: 'textbooks',
          images: ['https://example.com/image.jpg'],
          condition: 'new',
          status: 'active',
          isHidden: true,
          hiddenAt: Date.now(),
          hiddenReason: 'Test',
          createdAt: Date.now(),
          postedOn: Date.now(),
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);

      await expect(
        asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        })
      ).rejects.toThrow('Listing is not available');
    });
  });

  describe('markMessagesAsRead', () => {
    it('throws error when user is not a participant', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const other = await createTestUser(t, 'other@calpoly.edu', 'Other');

      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asOther = t.withIdentity(other.identity);

      await expect(
        asOther.mutation(api.messages.markMessagesAsRead, {
          conversationId,
        })
      ).rejects.toThrow('Forbidden');
    });

    it('updates buyerLastReadAt when buyer marks as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          buyerLastReadAt: 1,
        });
      });

      const result = await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      expect(result.ok).toBe(true);

      const conversationAfter = await t.run(async (ctx) => await ctx.db.get(conversationId));

      expect(conversationAfter!.buyerLastReadAt).toBeGreaterThan(1);
    });

    it('updates sellerLastReadAt when seller marks as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);

      await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          sellerLastReadAt: 1,
        });
      });

      await asSeller.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const conversationAfter = await t.run(async (ctx) => await ctx.db.get(conversationId));

      expect(conversationAfter!.sellerLastReadAt).toBeGreaterThan(1);
    });

    it('does not update conversation updatedAt when marking messages as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          buyerLastReadAt: 1,
        });
      });
      const conversationBefore = await t.run(async (ctx) => await ctx.db.get(conversationId));

      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const conversationAfter = await t.run(async (ctx) => await ctx.db.get(conversationId));

      expect(conversationAfter!.updatedAt).toBe(conversationBefore!.updatedAt);
      expect(conversationAfter!.buyerLastReadAt).toBeGreaterThan(
        conversationBefore!.buyerLastReadAt
      );
    });

    it('marks unread messages as read for buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      // Message from seller to buyer (unread)
      const messageId = await t.run(async (ctx) => {
        return await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: seller.id,
          recipientId: buyer.id,
          type: 'text',
          body: 'Hello buyer',
          createdAt: Date.now(),
          readAt: 0,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(message!.readAt).toBeGreaterThan(0);
    });

    it('marks unread messages in bounded patch chunks', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);
      const unreadMessageCount = 125;

      await t.run(async (ctx) => {
        for (let index = 0; index < unreadMessageCount; index += 1) {
          await ctx.db.insert('messages', {
            conversationId,
            listingId,
            senderId: seller.id,
            recipientId: buyer.id,
            type: 'text',
            body: `Unread ${index + 1}`,
            createdAt: Date.now() + index,
            readAt: 0,
          });
        }
      });

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const unreadMessages = await t.run(async (ctx) => {
        return await ctx.db
          .query('messages')
          .withIndex('by_conversation_recipient_readAt', (q) =>
            q.eq('conversationId', conversationId).eq('recipientId', buyer.id).eq('readAt', 0)
          )
          .collect();
      });

      expect(unreadMessages).toHaveLength(0);

      const messages = await asBuyer.query(api.messages.messagesByConversation, {
        conversationId,
      });
      expect(messages).toHaveLength(unreadMessageCount);
      expect(messages.every((message) => message.readAt > 0)).toBe(true);
    });

    it('does not mark messages sent by the user as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      // Message from buyer (shouldn't be marked as read by buyer)
      const messageId = await t.run(async (ctx) => {
        return await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'Hello seller',
          createdAt: Date.now(),
          readAt: 0,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(message!.readAt).toBe(0);
    });

    it('resets the stored unread count for the caller after marking as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      await t.run(async (ctx) => {
        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: seller.id,
          recipientId: buyer.id,
          type: 'text',
          body: 'Unread for buyer',
          createdAt: Date.now() + 1,
          readAt: 0,
        });
        await ctx.db.patch(conversationId, {
          buyerUnreadCount: 1,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const conversation = await t.run(async (ctx) => ctx.db.get(conversationId));
      expect(conversation?.buyerUnreadCount).toBe(0);
    });
  });

  describe('messagesByConversation', () => {
    it('throws error when user is not a participant', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const other = await createTestUser(t, 'other@calpoly.edu', 'Other');

      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asOther = t.withIdentity(other.identity);

      await expect(
        asOther.query(api.messages.messagesByConversation, {
          conversationId,
        })
      ).rejects.toThrow('Forbidden');
    });

    it('returns all messages in the conversation', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await seedConversationMessages(t, {
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        bodies: ['Message 1', 'Message 2'],
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const messages = await asBuyer.query(api.messages.messagesByConversation, {
        conversationId,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('Message 1');
      expect(messages[1].body).toBe('Message 2');
    });

    it('returns only the latest message slice when a limit is provided', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await seedConversationMessages(t, {
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        bodies: ['Body 1', 'Body 2', 'Body 3', 'Body 4'],
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const messages = await asBuyer.query(api.messages.messagesByConversation, {
        conversationId,
        limit: 2,
      });

      expect(messages.map((message) => message.body)).toEqual(['Body 3', 'Body 4']);
    });
  });

  describe('messagesByConversationPage', () => {
    it('returns the latest page in chronological order with a continue cursor', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await seedConversationMessages(t, {
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        bodies: [
          'Page message 1',
          'Page message 2',
          'Page message 3',
          'Page message 4',
          'Page message 5',
        ],
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const page = await asBuyer.query(api.messages.messagesByConversationPage, {
        conversationId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page.page.map((message) => message.body)).toEqual([
        'Page message 4',
        'Page message 5',
      ]);
      expect(page.continueCursor).toBeTruthy();
      expect(page.isDone).toBe(false);
    });

    it('returns older pages when a continue cursor is provided', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer-two@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller-two@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await seedConversationMessages(t, {
        conversationId,
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
        bodies: [
          'Older message 1',
          'Older message 2',
          'Older message 3',
          'Older message 4',
          'Older message 5',
        ],
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const firstPage = await asBuyer.query(api.messages.messagesByConversationPage, {
        conversationId,
        paginationOpts: { numItems: 2, cursor: null },
      });
      const secondPage = await asBuyer.query(api.messages.messagesByConversationPage, {
        conversationId,
        paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
      });

      expect(secondPage.page.map((message) => message.body)).toEqual([
        'Older message 2',
        'Older message 3',
      ]);
      expect(secondPage.continueCursor).toBeTruthy();
      expect(secondPage.isDone).toBe(false);
    });
  });

  describe('backfillMessagingFieldsBatch', () => {
    it('patches missing conversation state and message types in bounded batches', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'batch-buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'batch-seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      const messageId = await t.run(async (ctx) => {
        await ctx.db.patch(conversationId, {
          participantIds: undefined,
        });

        return await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: buyer.id,
          recipientId: seller.id,
          body: 'Backfill me',
          createdAt: Date.now(),
          readAt: 0,
        });
      });

      const conversationResult = await t.mutation(internal.messages.backfillMessagingFieldsBatch, {
        conversationPagination: { numItems: 10, cursor: null },
      });
      const messageResult = await t.mutation(internal.messages.backfillMessagingFieldsBatch, {
        messagePagination: { numItems: 10, cursor: null },
      });

      const [conversation, message] = await Promise.all([
        t.run(async (ctx) => ctx.db.get(conversationId)),
        t.run(async (ctx) => ctx.db.get(messageId)),
      ]);

      expect(conversationResult.conversationPatches).toBeGreaterThanOrEqual(1);
      expect(messageResult.messagePatches).toBeGreaterThanOrEqual(1);
      expect(conversation?.participantIds).toEqual([buyer.id, seller.id]);
      expect(conversation?.lastMessagePreview).toBe('Backfill me');
      expect(conversation?.sellerUnreadCount).toBe(1);
      expect(message?.type).toBe('text');
    });
  });

  describe('createConversationAndSendFirstMessage', () => {
    it('creates conversation and sends first message', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      const result = await asBuyer.action(api.messages.createConversationAndSendFirstMessage, {
        listingId,
        body: 'Is this still available?',
      });

      expect(result.conversationId).toBeDefined();

      const conversation = await t.run(async (ctx) => await ctx.db.get(result.conversationId));
      expect(conversation).toMatchObject({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });
      expect(conversation!.lastMessageId).toBeDefined();

      const messages = await t.run(async (ctx) => {
        return await ctx.db
          .query('messages')
          .withIndex('by_conversation_createdAt', (q) =>
            q.eq('conversationId', result.conversationId)
          )
          .collect();
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('Is this still available?');
    });

    it('throws when blocked', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.blocks.blockUser, { blockedId: seller.id });

      await expect(
        asBuyer.action(api.messages.createConversationAndSendFirstMessage, {
          listingId,
          body: 'Hello',
        })
      ).rejects.toThrow('You cannot message this user');
    });
  });

  describe('debugCreateConversationID', () => {
    it('creates a conversation with provided IDs', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const result = await t.mutation(internal.messages.debugCreateConversationID, {
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });

      expect(result.conversationId).toBeDefined();

      const conversation = await t.run(async (ctx) => {
        return await ctx.db.get(result.conversationId);
      });

      expect(conversation).toMatchObject({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });
    });
  });
});

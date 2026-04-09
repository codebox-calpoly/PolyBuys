/* eslint-disable @typescript-eslint/no-explicit-any */

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

// Mock global fetch for OpenAI Moderation API calls
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    }),
  }) as any;
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

      await expect(async () => {
        await asOther.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        });
      }).rejects.toThrow('Forbidden');
    });

    it('rejects whitespace-only message bodies', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await expect(async () => {
        await asBuyer.action(api.messages.sendMessage, {
          conversationId,
          body: '   \n\t  ',
        });
      }).rejects.toThrow('Message cannot be empty');
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

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(result.messageId as any);
      });

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

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(result.messageId as any);
      });

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

      const conversationBefore = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });
      const oldUpdatedAt = conversationBefore!.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await asBuyer.action(api.messages.sendMessage, {
        conversationId,
        body: 'Test message',
      });

      const conversationAfter = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      expect(conversationAfter!.updatedAt).toBeGreaterThan(oldUpdatedAt);
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
      await expect(async () => {
        await asBuyer.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        });
      }).rejects.toThrow('You cannot message this user');
    });

    it('sendMessage throws when recipient has blocked sender', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      await asSeller.mutation(api.blocks.blockUser, { blockedId: buyer.id });
      await expect(async () => {
        await asSeller.action(api.messages.sendMessage, {
          conversationId,
          body: 'Hello',
        });
      }).rejects.toThrow('You cannot message this user');
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

      await expect(async () => {
        await asOther.query(api.messages.getConversationHistory, {
          conversationId,
        });
      }).rejects.toThrow('Forbidden');
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
  });

  describe('listUserConversations', () => {
    it('throws error when user is not authenticated', async () => {
      const t = createConvexTest();

      await expect(async () => {
        await t.query(api.messages.listUserConversations);
      }).rejects.toThrow('Unauthorized');
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
      await t.run(async (ctx: any) => {
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
      await t.run(async (ctx: any) => {
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

      await t.run(async (ctx: any) => {
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
  });

  describe('getOrCreateConversation', () => {
    it('throws error when user tries to message themselves', async () => {
      const t = createConvexTest();
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asSeller = t.withIdentity(seller.identity);

      await expect(async () => {
        await asSeller.mutation(api.messages.getOrCreateConversation, {
          listingId,
        });
      }).rejects.toThrow("You can't message yourself");
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

      await expect(async () => {
        await asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        });
      }).rejects.toThrow('Listing is not active');
    });

    it('throws error when buyer has blocked seller', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      await asBuyer.mutation(api.blocks.blockUser, { blockedId: seller.id });

      await expect(async () => {
        await asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        });
      }).rejects.toThrow('You cannot message this user');
    });

    it('throws error when seller has blocked buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      await asSeller.mutation(api.blocks.blockUser, { blockedId: buyer.id });

      const asBuyer = t.withIdentity(buyer.identity);
      await expect(async () => {
        await asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        });
      }).rejects.toThrow('You cannot message this user');
    });

    it('throws error when listing is hidden', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');

      // Create listing and manually mark it as hidden
      const listingId = await t.run(async (ctx: any) => {
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

      await expect(async () => {
        await asBuyer.mutation(api.messages.getOrCreateConversation, {
          listingId,
        });
      }).rejects.toThrow('Listing is not available');
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

      await expect(async () => {
        await asOther.mutation(api.messages.markMessagesAsRead, {
          conversationId,
        });
      }).rejects.toThrow('Forbidden');
    });

    it('updates buyerLastReadAt when buyer marks as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);

      const conversationBefore = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });
      const oldBuyerLastReadAt = conversationBefore!.buyerLastReadAt;

      // Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      expect(result.ok).toBe(true);

      const conversationAfter = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      expect(conversationAfter!.buyerLastReadAt).toBeGreaterThan(oldBuyerLastReadAt);
    });

    it('updates sellerLastReadAt when seller marks as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);

      const conversationBefore = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });
      const oldSellerLastReadAt = conversationBefore!.sellerLastReadAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await asSeller.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const conversationAfter = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      expect(conversationAfter!.sellerLastReadAt).toBeGreaterThan(oldSellerLastReadAt);
    });

    it('does not update conversation updatedAt when marking messages as read', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const conversationBefore = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await asBuyer.mutation(api.messages.markMessagesAsRead, {
        conversationId,
      });

      const conversationAfter = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

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

      await expect(async () => {
        await asOther.query(api.messages.messagesByConversation, {
          conversationId,
        });
      }).rejects.toThrow('Forbidden');
    });

    it('returns all messages in the conversation', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversationEmpty(t, listingId, buyer.id, seller.id);

      await t.run(async (ctx: any) => {
        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: buyer.id,
          recipientId: seller.id,
          type: 'text',
          body: 'Message 1',
          createdAt: Date.now(),
          readAt: 0,
        });

        await ctx.db.insert('messages', {
          conversationId,
          listingId,
          senderId: seller.id,
          recipientId: buyer.id,
          type: 'text',
          body: 'Message 2',
          createdAt: Date.now() + 1000,
          readAt: 0,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const messages = await asBuyer.query(api.messages.messagesByConversation, {
        conversationId,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('Message 1');
      expect(messages[1].body).toBe('Message 2');
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

      const conversation = await t.run(async (ctx: any) => {
        return await ctx.db.get(result.conversationId);
      });
      expect(conversation).toMatchObject({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });
      expect(conversation!.lastMessageId).toBeDefined();

      const messages = await t.run(async (ctx: any) => {
        return await ctx.db
          .query('messages')
          .withIndex('by_conversation_createdAt', (q: any) =>
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

      await expect(async () => {
        await asBuyer.action(api.messages.createConversationAndSendFirstMessage, {
          listingId,
          body: 'Hello',
        });
      }).rejects.toThrow('You cannot message this user');
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from '../_generated/api';
import {
  createConvexTest,
  createTestUser,
  createTestListing,
  createTestConversation,
} from './testUtils';

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

      expect(conversations.items).toEqual([]);
      expect(conversations.nextCursor).toBeNull();
    });

    it('returns conversations where user is buyer', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations.items).toHaveLength(1);
      expect(conversations.items[0].otherParticipant.id).toBe(seller.id);
    });

    it('returns conversations where user is seller', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      await createTestConversation(t, listingId, buyer.id, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      const conversations = await asSeller.query(api.messages.listUserConversations);

      expect(conversations.items).toHaveLength(1);
      expect(conversations.items[0].otherParticipant.id).toBe(buyer.id);
    });

    it('returns conversations sorted by most recent activity', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');

      const listingId1 = await createTestListing(t, seller.id, { title: 'Listing 1' });
      const listingId2 = await createTestListing(t, seller.id, { title: 'Listing 2' });

      // Create older conversation
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert('conversations', {
          listingId: listingId1,
          buyerId: buyer.id,
          sellerId: seller.id,
          participantIds: [buyer.id, seller.id],
          createdAt: now - 2000,
          updatedAt: now - 2000,
          buyerLastReadAt: now,
          sellerLastReadAt: now,
        });
      });

      // Create newer conversation
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert('conversations', {
          listingId: listingId2,
          buyerId: buyer.id,
          sellerId: seller.id,
          participantIds: [buyer.id, seller.id],
          createdAt: now - 1000,
          updatedAt: now - 1000,
          buyerLastReadAt: now,
          sellerLastReadAt: now,
        });
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const conversations = await asBuyer.query(api.messages.listUserConversations);

      expect(conversations.items).toHaveLength(2);
      expect(conversations.items[0].lastMessageAt).toBeGreaterThan(
        conversations.items[1].lastMessageAt
      );
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
      expect(conversationAfter!.updatedAt).toBe(conversationBefore!.updatedAt);
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
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      await t.run(async (ctx) => {
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

  describe('messagesByConversationPaginated', () => {
    it('returns latest messages first with a stable cursor', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);
      const conversationId = await createTestConversation(t, listingId, buyer.id, seller.id);

      await t.run(async (ctx) => {
        const base = Date.now();
        for (let i = 1; i <= 4; i += 1) {
          await ctx.db.insert('messages', {
            conversationId,
            listingId,
            senderId: i % 2 === 0 ? seller.id : buyer.id,
            recipientId: i % 2 === 0 ? buyer.id : seller.id,
            type: 'text',
            body: `Message ${i}`,
            createdAt: base + i,
            readAt: 0,
          });
        }
      });

      const asBuyer = t.withIdentity(buyer.identity);
      const firstPage = await asBuyer.query(api.messages.messagesByConversationPaginated, {
        conversationId,
        limit: 2,
      });

      expect(firstPage.items.map((m) => m.body)).toEqual(['Message 3', 'Message 4']);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await asBuyer.query(api.messages.messagesByConversationPaginated, {
        conversationId,
        limit: 2,
        cursor: firstPage.nextCursor!,
      });

      expect(secondPage.items.map((m) => m.body)).toEqual(['Message 1', 'Message 2']);
      expect(secondPage.nextCursor).toBeNull();
    });
  });

  describe('getOrCreateConversation', () => {
    it('creates a conversation with explicit participantIds (per DECISIONS.md)', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const result = await asBuyer.mutation(api.messages.getOrCreateConversation, { listingId });

      expect(result.conversationId).toBeDefined();

      const conversation = await t.run(async (ctx) => {
        return await ctx.db.get(result.conversationId);
      });

      expect(conversation).toMatchObject({
        listingId,
        buyerId: buyer.id,
        sellerId: seller.id,
      });
      // DECISIONS.md: explicit participant IDs must be stored on the conversation
      expect(conversation?.participantIds).toEqual(expect.arrayContaining([buyer.id, seller.id]));
      expect(conversation?.participantIds).toHaveLength(2);
    });

    it('is idempotent — returns the same conversationId on repeat calls', async () => {
      const t = createConvexTest();

      const buyer = await createTestUser(t, 'buyer@calpoly.edu', 'Buyer');
      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asBuyer = t.withIdentity(buyer.identity);
      const first = await asBuyer.mutation(api.messages.getOrCreateConversation, { listingId });
      const second = await asBuyer.mutation(api.messages.getOrCreateConversation, { listingId });

      expect(first.conversationId).toBe(second.conversationId);
    });

    it('prevents a seller from messaging their own listing', async () => {
      const t = createConvexTest();

      const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
      const listingId = await createTestListing(t, seller.id);

      const asSeller = t.withIdentity(seller.identity);
      await expect(
        asSeller.mutation(api.messages.getOrCreateConversation, { listingId })
      ).rejects.toThrow("You can't message yourself");
    });
  });
});

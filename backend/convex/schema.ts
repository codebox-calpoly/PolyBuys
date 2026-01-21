import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  listings: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    sellerEmail: v.string(),
    category: v.union(
      v.literal('textbooks'),
      v.literal('electronics'),
      v.literal('furniture'),
      v.literal('tickets'),
      v.literal('other')
    ),
    status: v.union(v.literal('active'), v.literal('sold'), v.literal('inactive')),
    createdAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_category', ['category'])
    .searchIndex('search_title', {
      searchField: 'title',
    }),

  conversations: defineTable({
    listingId: v.id('listings'),
    buyerId: v.string(),
    sellerId: v.string(),
    participantIds: v.array(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessageId: v.optional(v.id('messages')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_listing_buyer_seller', ['listingId', 'buyerId', 'sellerId'])
    .index('by_updatedAt', ['updatedAt']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderId: v.string(),
    body: v.string(),
    type: v.string(),
    createdAt: v.number(),
    read: v.boolean(),
  }).index('by_conversation', ['conversationId', 'createdAt']),
});

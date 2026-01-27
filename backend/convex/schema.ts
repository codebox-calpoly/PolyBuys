import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  listings: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    sellerEmail: v.string(),
    sellerId: v.string(),
    images: v.array(v.string()),
    condition: v.union(v.literal('new'), v.literal('used'), v.literal('refurbished')),
    category: v.union(
      v.literal('textbooks'),
      v.literal('electronics'),
      v.literal('furniture'),
      v.literal('tickets'),
      v.literal('other')
    ),
    status: v.union(
      v.literal('active'),
      v.literal('sold'),
      v.literal('inactive'),
      v.literal('deleted')
    ),
    createdAt: v.number(),
    postedOn: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_category', ['category'])
    .index('by_status_category', ['status', 'category'])
    .index('by_status_createdAt', ['status', 'createdAt'])
    .searchIndex('search_listings', {
      searchField: 'title',
      filterFields: ['status', 'category', 'condition', 'description'],
    }),

  users: defineTable({
    email: v.string(),
    name: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index('by_email', ['email']),

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

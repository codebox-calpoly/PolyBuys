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
    tags: v.optional(v.array(v.string())),
  })
    .index('by_status', ['status'])
    .index('by_category', ['category'])
    .index('by_status_category', ['status', 'category'])
    .index('by_status_createdAt', ['status', 'createdAt'])
    .index('by_tag', ['tags'])
    .searchIndex('search_listings', {
      searchField: 'title',
      filterFields: ['status', 'category', 'condition', 'description'],
    }),

  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    joinDate: v.number(),
    major: v.string(),
    year: v.number(),
    rating: v.number(),
    review_count: v.number(),
  })
    .index('by_name', ['name'])
    .index('by_userId', ['userId']),
  users: defineTable({
    email: v.string(),
    name: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  conversations: defineTable({
    listingId: v.id('listings'),
    buyerId: v.string(),
    sellerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    buyerLastReadAt: v.number(),
    sellerLastReadAt: v.number(),
  })
    .index('by_listing_buyer_seller', ['listingId', 'buyerId'])
    .index('by_buyer', ['buyerId', 'updatedAt'])
    .index('by_seller', ['sellerId', 'updatedAt'])
    .index('by_listing', ['listingId']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    senderId: v.string(),
    recipientId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    readAt: v.number(),
  })
    .index('by_conversation_createdAt', ['conversationId', 'createdAt'])
    .index('by_conversation_recipient_readAt', ['conversationId', 'recipientId', 'readAt']),
});

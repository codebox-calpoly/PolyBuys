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
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenReason: v.optional(v.string()),
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
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenReason: v.optional(v.string()),
  })
    .index('by_name', ['name'])
    .index('by_userId', ['userId']),
  users: defineTable({
    email: v.string(),
    name: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  reports: defineTable({
    targetId: v.string(), // Can be listing or profile ID
    targetType: v.union(v.literal('listing'), v.literal('profile')),
    reporterId: v.id('users'),
    reason: v.union(v.literal('scam'), v.literal('inappropriate'), v.literal('spam')),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_target', ['targetId', 'targetType'])
    .index('by_reporter', ['reporterId']),
});

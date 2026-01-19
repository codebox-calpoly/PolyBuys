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
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.union(v.string(), v.null()),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  // Store verification tokens for email validation
  verificationTokens: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_token', ['token']),
});

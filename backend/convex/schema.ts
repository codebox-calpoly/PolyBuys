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
});

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
});

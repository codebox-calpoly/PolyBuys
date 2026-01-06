import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

// Get all active listings
export const getListings = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query('listings')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .order('desc')
      .collect();
    return listings;
  },
});

// Get a single listing by ID
export const getListing = query({
  args: { id: v.id('listings') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new listing
export const createListing = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const listingId = await ctx.db.insert('listings', {
      ...args,
      status: 'active',
      createdAt: Date.now(),
    });
    return listingId;
  },
});

// Update listing status
export const updateListingStatus = mutation({
  args: {
    id: v.id('listings'),
    status: v.union(v.literal('active'), v.literal('sold'), v.literal('inactive')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Search listings by title
export const searchListings = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('listings')
      .withSearchIndex('search_title', (q) => q.search('title', args.searchTerm))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect();
  },
});

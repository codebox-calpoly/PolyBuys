import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

export type ListingCondition = 'new' | 'used' | 'refurbished';
export type ListingStatus = 'active' | 'sold' | 'inactive' | 'deleted';
export type Listing = Doc<'listings'> & {
  condition: ListingCondition;
  status: ListingStatus;
};

async function verifyOwnership(
  ctx: MutationCtx,
  listingId: Id<'listings'>
): Promise<Doc<'listings'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('You must be logged in to perform this action');
  }
  const listing = await ctx.db.get(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }
  if (listing.sellerId !== identity.subject) {
    throw new Error('You are not the owner of this listing');
  }
  return listing;
}
function validateTitle(title: string) {
  if (title.length < 5 || title.length > 100) {
    throw new Error('Title must be 5-100 characters');
  }
}

function validateImages(images: string[]) {
  if (images.length < 1 || images.length > 8) {
    throw new Error('Must have 1-8 images');
  }
}

// Get all active listings
export const getListings = query({
  args: { tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const query = ctx.db.query('listings').withIndex('by_status', (q) => q.eq('status', 'active'));

    const listings = await query.order('desc').collect();

    // Filter by tags if provided (OR logic: show listings with ANY selected tag)
    if (args.tags && args.tags.length > 0) {
      return listings.filter((listing) => {
        if (!listing.tags || listing.tags.length === 0) return false;
        return args.tags!.some((tag) => listing.tags!.includes(tag));
      });
    }

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
    images: v.array(v.string()),
    condition: v.union(v.literal('new'), v.literal('used'), v.literal('refurbished')),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('You must be logged in to create a listing');
    }
    validateTitle(args.title);
    validateImages(args.images);
    const now = Date.now();
    const listingId = await ctx.db.insert('listings', {
      ...args,
      sellerId: identity.subject,
      status: 'active',
      createdAt: now,
      postedOn: now,
    });
    return listingId;
  },
});

export const updateListing = mutation({
  args: {
    id: v.id('listings'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    images: v.optional(v.array(v.string())),
    condition: v.optional(v.union(v.literal('new'), v.literal('used'), v.literal('refurbished'))),
    category: v.optional(
      v.union(
        v.literal('textbooks'),
        v.literal('electronics'),
        v.literal('furniture'),
        v.literal('tickets'),
        v.literal('other')
      )
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const listing = await verifyOwnership(ctx, args.id);

    if (listing.status === 'deleted') {
      throw new Error('Cannot update a deleted listing');
    }

    const update: Partial<Doc<'listings'>> = {};

    if (args.title !== undefined) {
      validateTitle(args.title);
      update.title = args.title;
    }

    if (args.images !== undefined) {
      validateImages(args.images);
      update.images = args.images;
    }

    if (args.condition !== undefined) {
      update.condition = args.condition;
    }

    if (args.category !== undefined) {
      update.category = args.category;
    }

    if (args.price !== undefined) {
      if (args.price < 0) {
        throw new Error('Price must be non-negative');
      }
      update.price = args.price;
    }
    if (args.description !== undefined) {
      update.description = args.description;
    }

    if (args.tags !== undefined) {
      update.tags = args.tags;
    }

    if (Object.keys(update).length === 0) {
      throw new Error('No valid fields to update');
    }

    await ctx.db.patch(args.id, update);
  },
});

// Update listing status
export const updateListingStatus = mutation({
  args: {
    id: v.id('listings'),
    status: v.union(v.literal('active'), v.literal('sold'), v.literal('inactive')),
  },
  handler: async (ctx, args) => {
    await verifyOwnership(ctx, args.id);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteListing = mutation({
  args: {
    id: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const listing = await verifyOwnership(ctx, args.id);
    if (listing.status === 'deleted') {
      return;
    }
    await ctx.db.patch(args.id, { status: 'deleted' });
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

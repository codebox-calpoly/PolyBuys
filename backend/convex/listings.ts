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

export const TAG_CONSTRAINTS = {
  MAX_TAGS: 5,
  MAX_TAG_LENGTH: 20,
  MIN_TAG_LENGTH: 1,
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

const ITEMS_PER_PAGE = 20;

// Category validator for reuse
const categoryValidator = v.union(
  v.literal('textbooks'),
  v.literal('electronics'),
  v.literal('furniture'),
  v.literal('tickets'),
  v.literal('other')
);

// Condition validator for reuse
const conditionValidator = v.union(v.literal('new'), v.literal('used'), v.literal('refurbished'));

// Get all active listings with optional filtering
// Sorted by newest first (deterministic ordering)
export const getListings = query({
  args: {
    category: v.optional(categoryValidator),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    limit: v.optional(v.number()), // default 20
  },
  handler: async (ctx, args) => {
    // Validate price filters
    if (args.minPrice !== undefined && args.minPrice < 0) {
      throw new Error('minPrice must be non-negative');
    }
    if (
      args.maxPrice !== undefined &&
      args.minPrice !== undefined &&
      args.maxPrice < args.minPrice
    ) {
      throw new Error('maxPrice must be greater than or equal to minPrice');
    }

    // Use by_status_createdAt index for deterministic newest-first ordering
    const query = ctx.db
      .query('listings')
      .withIndex('by_status_createdAt', (q) => q.eq('status', 'active'))
      .order('desc');

    // Apply filters
    const listings = await query
      .filter((q) => {
        let conditions = q.neq(q.field('isHidden'), true);

        if (args.category) {
          conditions = q.and(conditions, q.eq(q.field('category'), args.category));
        }
        if (args.minPrice !== undefined) {
          conditions = q.and(conditions, q.gte(q.field('price'), args.minPrice));
        }
        if (args.maxPrice !== undefined) {
          conditions = q.and(conditions, q.lte(q.field('price'), args.maxPrice));
        }

        return conditions;
      })
      .take(args.limit ?? ITEMS_PER_PAGE);

    return listings;
  },
});

// Normalize tages to lowercase and within 1-20 characters exclusive
function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 1 && tag.length <= 20)
    ),
  ].slice(0, 5);
}

// Get a single listing by ID
// Owners can see their own hidden listings, others cannot
export const getListing = query({
  args: { id: v.id('listings') },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) return null;

    // If listing is hidden, only allow owner to see it
    if (listing.isHidden) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || identity.subject !== listing.sellerId) {
        return null; // Hidden from non-owners
      }
    }

    return listing;
  },
});

/**
 * Search and filter listings with pagination
 * Supports full-text search, category/price/condition filters, and sorting
 */
export const searchAndFilterListings = query({
  args: {
    filters: v.optional(
      v.object({
        searchTerm: v.optional(v.string()),
        category: v.optional(categoryValidator),
        minPrice: v.optional(v.number()),
        maxPrice: v.optional(v.number()),
        condition: v.optional(conditionValidator),
        sortBy: v.optional(
          v.union(
            v.literal('newest'),
            v.literal('oldest'),
            v.literal('price_asc'),
            v.literal('price_desc')
          )
        ),
      })
    ),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const filters = args.filters ?? {};
    const searchTerm = filters.searchTerm?.trim();

    let results;

    // If there's a search term, use the search index
    if (searchTerm) {
      const searchQuery = ctx.db.query('listings').withSearchIndex('search_listings', (q) => {
        let sq = q.search('title', searchTerm).eq('status', 'active');
        if (filters.category) {
          sq = sq.eq('category', filters.category);
        }
        if (filters.condition) {
          sq = sq.eq('condition', filters.condition);
        }
        return sq;
      });

      results = await searchQuery.collect();
    } else {
      // No search term - use regular query with index
      let dbQuery;

      if (filters.category) {
        dbQuery = ctx.db
          .query('listings')
          .withIndex('by_status_category', (q) =>
            q.eq('status', 'active').eq('category', filters.category!)
          );
      } else {
        dbQuery = ctx.db.query('listings').withIndex('by_status', (q) => q.eq('status', 'active'));
      }

      results = await dbQuery.collect();

      // Apply condition filter in memory (not in index)
      if (filters.condition) {
        results = results.filter((l) => l.condition === filters.condition);
      }
    }

    // Apply price range filters in memory
    if (filters.minPrice !== undefined) {
      results = results.filter((l) => l.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter((l) => l.price <= filters.maxPrice!);
    }

    // Filter out hidden content
    results = results.filter((l) => l.isHidden !== true);

    // Apply sorting
    const sortBy = filters.sortBy ?? 'newest';
    switch (sortBy) {
      case 'newest':
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        results.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'price_asc':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        results.sort((a, b) => b.price - a.price);
        break;
    }

    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = parseInt(args.cursor, 10);
      if (!isNaN(cursorIndex)) {
        startIndex = cursorIndex;
      }
    }

    const paginatedResults = results.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const hasMore = startIndex + ITEMS_PER_PAGE < results.length;
    const nextCursor = hasMore ? String(startIndex + ITEMS_PER_PAGE) : null;

    return {
      items: paginatedResults,
      nextCursor,
      hasMore,
    };
  },
});

// Create a new listing
export const createListing = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    sellerEmail: v.string(),
    category: categoryValidator,
    images: v.array(v.string()),
    condition: conditionValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('You must be logged in to create a listing');
    }

    if (args.tags) {
      if (args.tags.length > TAG_CONSTRAINTS.MAX_TAGS) {
        throw new Error(`Maximum ${TAG_CONSTRAINTS.MAX_TAGS} tags allowed`);
      }

      for (const tag of args.tags) {
        const trimmed = tag.trim();
        if (!trimmed) {
          throw new Error('Empty tags are not allowed');
        }
        if (trimmed.length > TAG_CONSTRAINTS.MAX_TAG_LENGTH) {
          throw new Error(`Tags must be ${TAG_CONSTRAINTS.MAX_TAG_LENGTH} characters or less`);
        }
      }
    }
    // Normalize before saving
    const normalizedTags = normalizeTags(args.tags ?? []);
    validateTitle(args.title);
    validateImages(args.images);
    const now = Date.now();
    const listingId = await ctx.db.insert('listings', {
      ...args,
      sellerId: identity.subject,
      status: 'active',
      createdAt: now,
      postedOn: now,
      tags: normalizedTags,
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
    condition: v.optional(conditionValidator),
    category: v.optional(categoryValidator),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const listing = await verifyOwnership(ctx, args.id);

    if (listing.status === 'deleted') {
      throw new Error('Cannot update a deleted listing');
    }

    if (args.tags) {
      if (args.tags.length > TAG_CONSTRAINTS.MAX_TAGS) {
        throw new Error(`Maximum ${TAG_CONSTRAINTS.MAX_TAGS} tags allowed`);
      }

      for (const tag of args.tags) {
        const trimmed = tag.trim();
        if (!trimmed) {
          throw new Error('Empty tags are not allowed');
        }
        if (trimmed.length > TAG_CONSTRAINTS.MAX_TAG_LENGTH) {
          throw new Error(`Tags must be ${TAG_CONSTRAINTS.MAX_TAG_LENGTH} characters or less`);
        }
      }
    }
    // Normalize before saving
    const normalizedTags = normalizeTags(args.tags ?? []);

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
      update.tags = normalizedTags;
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

// Search listings by title (legacy - use searchAndFilterListings instead)
export const searchListings = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('listings')
      .withSearchIndex('search_listings', (q) =>
        q.search('title', args.searchTerm).eq('status', 'active')
      )
      .collect();

    // Filter out hidden content
    return results.filter((l) => l.isHidden !== true);
  },
});

// Get user's own hidden listings (for owner awareness)
export const getMyHiddenListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('You must be logged in to view your hidden listings');
    }

    return await ctx.db
      .query('listings')
      .filter((q) =>
        q.and(q.eq(q.field('sellerId'), identity.subject), q.eq(q.field('isHidden'), true))
      )
      .collect();
  },
});

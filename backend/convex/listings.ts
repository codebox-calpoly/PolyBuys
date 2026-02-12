import { v, ConvexError } from 'convex/values';
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

export const PAYLOAD_BOUNDS = {
  TITLE_MIN: 5,
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 5000,
  IMAGES_MIN: 1,
  IMAGES_MAX: 8,
  PRICE_MAX: 1_000_000,
};

async function verifyOwnership(
  ctx: MutationCtx,
  listingId: Id<'listings'>
): Promise<Doc<'listings'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('You must be logged in to perform this action');
  }
  const listing = await ctx.db.get(listingId);
  if (!listing) {
    throw new ConvexError('Listing not found');
  }
  if (listing.sellerId !== identity.subject) {
    throw new ConvexError('You are not the owner of this listing');
  }
  return listing;
}
function validateTitle(title: string): string {
  const trimmedTitle = title.trim();
  if (
    trimmedTitle.length < PAYLOAD_BOUNDS.TITLE_MIN ||
    trimmedTitle.length > PAYLOAD_BOUNDS.TITLE_MAX
  ) {
    throw new ConvexError(
      `Title must be ${PAYLOAD_BOUNDS.TITLE_MIN}-${PAYLOAD_BOUNDS.TITLE_MAX} characters`
    );
  }
  return trimmedTitle;
}

function validateDescription(description: string) {
  if (description.length > PAYLOAD_BOUNDS.DESCRIPTION_MAX) {
    throw new ConvexError(
      `Description must be ${PAYLOAD_BOUNDS.DESCRIPTION_MAX} characters or less`
    );
  }
}

function validateImages(images: string[]) {
  if (images.length < PAYLOAD_BOUNDS.IMAGES_MIN || images.length > PAYLOAD_BOUNDS.IMAGES_MAX) {
    throw new ConvexError(
      `Must have ${PAYLOAD_BOUNDS.IMAGES_MIN}-${PAYLOAD_BOUNDS.IMAGES_MAX} images`
    );
  }
}

function validateTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;

  // Normalize and deduplicate tags
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new ConvexError('Empty tags are not allowed');
    }

    if (normalized.length > TAG_CONSTRAINTS.MAX_TAG_LENGTH) {
      throw new ConvexError(`Tags must be ${TAG_CONSTRAINTS.MAX_TAG_LENGTH} characters or less`);
    }

    // Skip duplicates instead of throwing
    if (!seen.has(normalized)) {
      seen.add(normalized);
      normalizedTags.push(normalized);
    }
  }

  // Check max tags after deduplication
  if (normalizedTags.length > TAG_CONSTRAINTS.MAX_TAGS) {
    throw new ConvexError(`Maximum ${TAG_CONSTRAINTS.MAX_TAGS} tags allowed`);
  }

  return normalizedTags;
}

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

function normalizeSearchTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 1 && tag.length <= TAG_CONSTRAINTS.MAX_TAG_LENGTH)
    ),
  ];
}

// Get a single listing by ID
// Owners can see their own hidden listings, others cannot
export const getListing = query({
  args: { id: v.id('listings') },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) return null;

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = !!identity && identity.subject === listing.sellerId;

    // Public visibility policy: only active listings are visible to non-owners.
    if (!isOwner && listing.status !== 'active') {
      return null;
    }

    // Hidden listings are only visible to their owner.
    if (!isOwner && listing.isHidden) {
      return null;
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
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    // Validate pagination bounds to prevent DoS
    if (args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      throw new ConvexError('numItems must be between 1 and 100');
    }

    const filters = args.filters ?? {};
    const searchTerm = filters.searchTerm?.trim();
    const sortBy = filters.sortBy ?? 'newest';

    // LIMITATION: Full-text search requires collect() - Convex search indexes don't support paginate()
    // This is acceptable because search results are typically limited by search relevance.
    // Production mitigation: Monitor search result sizes, consider limiting search to specific categories.
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

      const MAX_SEARCH_COLLECT = 1000;
      // For search queries, we must collect since search indexes don't support paginate()
      let results = await searchQuery.take(MAX_SEARCH_COLLECT);

      // Apply price range filters in memory (search indexes don't support range queries)
      if (filters.minPrice !== undefined) {
        results = results.filter((l) => l.price >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        results = results.filter((l) => l.price <= filters.maxPrice!);
      }

      // Filter out hidden content
      results = results.filter((l) => l.isHidden !== true);

      // Apply sorting
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

      // Manual pagination for search results
      const cursor = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
      const startIndex = isNaN(cursor) ? 0 : cursor;
      const paginatedResults = results.slice(startIndex, startIndex + args.paginationOpts.numItems);
      const hasMore = startIndex + args.paginationOpts.numItems < results.length;
      const nextCursor = hasMore ? String(startIndex + args.paginationOpts.numItems) : null;

      return {
        page: paginatedResults,
        continueCursor: nextCursor,
        isDone: !hasMore,
      };
    }

    // No search term - use optimized index-based queries with database-level sorting and pagination
    const hasCategory = !!filters.category;
    const hasCondition = !!filters.condition;
    const needsPostFiltering =
      // maxPrice needs post-filtering for non-price-sorted queries (can use db-level filter for price-sorted)
      (filters.maxPrice !== undefined && sortBy !== 'price_asc' && sortBy !== 'price_desc') ||
      (filters.minPrice !== undefined && sortBy !== 'price_asc' && sortBy !== 'price_desc') ||
      // Condition filter needs post-filtering when using price-based indexes (which don't include condition)
      (filters.condition !== undefined && (sortBy === 'price_asc' || sortBy === 'price_desc'));

    let query;

    // Choose the best index based on filters and sort order
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      // Use price-based indexes for price sorting
      if (hasCategory) {
        if (filters.minPrice !== undefined) {
          query = ctx.db
            .query('listings')
            .withIndex('by_status_category_price', (q) =>
              q
                .eq('status', 'active')
                .eq('category', filters.category!)
                .gte('price', filters.minPrice!)
            )
            .order(sortBy === 'price_asc' ? 'asc' : 'desc');
        } else {
          query = ctx.db
            .query('listings')
            .withIndex('by_status_category_price', (q) =>
              q.eq('status', 'active').eq('category', filters.category!)
            )
            .order(sortBy === 'price_asc' ? 'asc' : 'desc');
        }
      } else {
        if (filters.minPrice !== undefined) {
          query = ctx.db
            .query('listings')
            .withIndex('by_status_price', (q) =>
              q.eq('status', 'active').gte('price', filters.minPrice!)
            )
            .order(sortBy === 'price_asc' ? 'asc' : 'desc');
        } else {
          query = ctx.db
            .query('listings')
            .withIndex('by_status_price', (q) => q.eq('status', 'active'))
            .order(sortBy === 'price_asc' ? 'asc' : 'desc');
        }
      }
    } else {
      // Use createdAt-based indexes for date sorting (newest/oldest)
      if (hasCategory && hasCondition) {
        query = ctx.db
          .query('listings')
          .withIndex('by_status_category_condition_createdAt', (q) =>
            q
              .eq('status', 'active')
              .eq('category', filters.category!)
              .eq('condition', filters.condition!)
          )
          .order(sortBy === 'oldest' ? 'asc' : 'desc');
      } else if (hasCondition) {
        query = ctx.db
          .query('listings')
          .withIndex('by_status_condition_createdAt', (q) =>
            q.eq('status', 'active').eq('condition', filters.condition!)
          )
          .order(sortBy === 'oldest' ? 'asc' : 'desc');
      } else if (hasCategory) {
        query = ctx.db
          .query('listings')
          .withIndex('by_status_category_createdAt', (q) =>
            q.eq('status', 'active').eq('category', filters.category!)
          )
          .order(sortBy === 'oldest' ? 'asc' : 'desc');
      } else {
        query = ctx.db
          .query('listings')
          .withIndex('by_status_createdAt', (q) => q.eq('status', 'active'))
          .order(sortBy === 'oldest' ? 'asc' : 'desc');
      }
    }

    // If no post-filtering needed, use direct pagination (most efficient)
    if (!needsPostFiltering) {
      let dbQuery = query.filter((q) => q.neq(q.field('isHidden'), true));

      // Apply maxPrice filter at database level for price-sorted queries
      if (filters.maxPrice !== undefined && (sortBy === 'price_asc' || sortBy === 'price_desc')) {
        dbQuery = dbQuery.filter((q) => q.lte(q.field('price'), filters.maxPrice!));
      }

      const paginationResult = await dbQuery.paginate(args.paginationOpts);

      return {
        page: paginationResult.page,
        continueCursor: paginationResult.continueCursor,
        isDone: paginationResult.isDone,
      };
    }

    // Need post-filtering: collect with limit, filter, then paginate in-memory
    // This is necessary because filters can't be expressed in indexes
    const MAX_COLLECT = 1000; // Limit to prevent excessive memory usage

    const allResults = await query
      .filter((q) => q.neq(q.field('isHidden'), true))
      .take(MAX_COLLECT);

    // Apply remaining filters
    const filtered = allResults.filter((l) => {
      if (filters.maxPrice !== undefined && l.price > filters.maxPrice) return false;
      if (
        sortBy !== 'price_asc' &&
        sortBy !== 'price_desc' &&
        filters.minPrice !== undefined &&
        l.price < filters.minPrice
      )
        return false;
      // Apply condition filter if not enforced by index
      if (filters.condition && l.condition !== filters.condition) return false;
      return true;
    });

    // Manual pagination on filtered results
    const requestedItems = args.paginationOpts.numItems;
    const cursor = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
    const startIndex = isNaN(cursor) ? 0 : cursor;
    const endIndex = startIndex + requestedItems;
    const page = filtered.slice(startIndex, endIndex);
    const hasMore = endIndex < filtered.length;
    const nextCursor = hasMore ? String(endIndex) : null;

    // Always mark as done when filtered results are exhausted to prevent infinite empty pages
    const isDone = !hasMore;

    return {
      page,
      continueCursor: nextCursor,
      isDone,
    };
  },
});

// Get all active listings with optional tag/category/price filters
export const getListings = query({
  args: {
    category: v.optional(categoryValidator),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    // Validate pagination bounds to prevent DoS
    if (args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      throw new ConvexError('numItems must be between 1 and 100');
    }

    // Validate price filters
    if (args.minPrice !== undefined && args.minPrice < 0) {
      throw new ConvexError('minPrice must be non-negative');
    }
    if (args.maxPrice !== undefined && args.maxPrice < 0) {
      throw new ConvexError('maxPrice must be non-negative');
    }
    if (
      args.maxPrice !== undefined &&
      args.minPrice !== undefined &&
      args.maxPrice < args.minPrice
    ) {
      throw new ConvexError('maxPrice must be greater than or equal to minPrice');
    }

    const normalizedTags = args.tags ? normalizeSearchTags(args.tags) : [];
    const hasTags = normalizedTags.length > 0;
    const hasPriceFilters = args.minPrice !== undefined || args.maxPrice !== undefined;

    // Use database indexes with proper ordering
    let query;
    if (args.category) {
      query = ctx.db
        .query('listings')
        .withIndex('by_status_category_createdAt', (q) =>
          q.eq('status', 'active').eq('category', args.category!)
        )
        .order('desc');
    } else {
      query = ctx.db
        .query('listings')
        .withIndex('by_status_createdAt', (q) => q.eq('status', 'active'))
        .order('desc');
    }

    // If no tags/price filters, use direct pagination (most efficient)
    if (!hasTags && !hasPriceFilters) {
      const paginationResult = await query
        .filter((q) => q.neq(q.field('isHidden'), true))
        .paginate(args.paginationOpts);

      return {
        page: paginationResult.page,
        continueCursor: paginationResult.continueCursor,
        isDone: paginationResult.isDone,
      };
    }

    // Need tags/price filtering: collect with limit, filter, then paginate in-memory
    // This is necessary because filters can't be expressed in indexes
    const MAX_COLLECT = 1000; // Limit to prevent excessive memory usage

    const allResults = await query
      .filter((q) => q.neq(q.field('isHidden'), true))
      .take(MAX_COLLECT);

    // Apply tag and price filters
    const filtered = allResults.filter((l) => {
      if (hasTags && !(l.tags ?? []).some((tag) => normalizedTags.includes(tag))) return false;
      if (args.minPrice !== undefined && l.price < args.minPrice) return false;
      if (args.maxPrice !== undefined && l.price > args.maxPrice) return false;
      return true;
    });

    // Manual pagination on filtered results
    const requestedItems = args.paginationOpts.numItems;
    const cursor = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor, 10) : 0;
    const startIndex = isNaN(cursor) ? 0 : cursor;
    const endIndex = startIndex + requestedItems;
    const page = filtered.slice(startIndex, endIndex);
    const hasMore = endIndex < filtered.length;
    const nextCursor = hasMore ? String(endIndex) : null;

    // Always mark as done when filtered results are exhausted to prevent infinite empty pages
    const isDone = !hasMore;

    return {
      page,
      continueCursor: nextCursor,
      isDone,
    };
  },
});

// Create a new listing
export const createListing = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: categoryValidator,
    images: v.array(v.string()),
    condition: conditionValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to create a listing');
    }
    if (!identity.email) {
      throw new ConvexError('Authenticated user email is required to create a listing');
    }

    const validatedTitle = validateTitle(args.title);
    validateDescription(args.description);
    validateImages(args.images);
    if (args.price < 0) {
      throw new ConvexError('Price must be non-negative');
    }
    if (args.price > PAYLOAD_BOUNDS.PRICE_MAX) {
      throw new ConvexError(`Price must be ${PAYLOAD_BOUNDS.PRICE_MAX} or less`);
    }
    const normalizedTags = validateTags(args.tags);
    const now = Date.now();

    const listingId = await ctx.db.insert('listings', {
      title: validatedTitle,
      description: args.description,
      price: args.price,
      category: args.category,
      images: args.images,
      condition: args.condition,
      tags: normalizedTags,
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
    condition: v.optional(conditionValidator),
    category: v.optional(categoryValidator),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const listing = await verifyOwnership(ctx, args.id);

    if (listing.status === 'deleted') {
      throw new ConvexError('Cannot update a deleted listing');
    }

    const update: Partial<Doc<'listings'>> = {};

    if (args.title !== undefined) {
      const validatedTitle = validateTitle(args.title);
      update.title = validatedTitle;
    }

    if (args.description !== undefined) {
      validateDescription(args.description);
      update.description = args.description;
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
        throw new ConvexError('Price must be non-negative');
      }
      if (args.price > PAYLOAD_BOUNDS.PRICE_MAX) {
        throw new ConvexError(`Price must be ${PAYLOAD_BOUNDS.PRICE_MAX} or less`);
      }
      update.price = args.price;
    }
    if (args.tags !== undefined) {
      const normalizedTags = validateTags(args.tags);
      update.tags = normalizedTags;
    }

    if (Object.keys(update).length === 0) {
      throw new ConvexError('No valid fields to update');
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
    const listing = await verifyOwnership(ctx, args.id);
    if (listing.status === 'deleted') {
      throw new ConvexError('Cannot change status of a deleted listing');
    }
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
// @deprecated Use searchAndFilterListings instead for better filtering and pagination support
export const searchListings = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const MAX_SEARCH_COLLECT = 1000;
    const results = await ctx.db
      .query('listings')
      .withSearchIndex('search_listings', (q) =>
        q.search('title', args.searchTerm).eq('status', 'active')
      )
      .take(MAX_SEARCH_COLLECT);

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
      throw new ConvexError('You must be logged in to view your hidden listings');
    }

    return await ctx.db
      .query('listings')
      .filter((q) =>
        q.and(q.eq(q.field('sellerId'), identity.subject), q.eq(q.field('isHidden'), true))
      )
      .collect();
  },
});

// Get current user's identity subject
export const getCurrentUserSubject = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
});

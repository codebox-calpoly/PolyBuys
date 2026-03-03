import { v, ConvexError } from 'convex/values';
import { query, mutation, action, internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { isCalPolyEmail } from '@polybuys/shared';

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

const MAX_PAGE_SIZE = 100;
const MAX_MANUAL_COLLECT = 1000;
const MAX_SEARCH_TERM_LENGTH = 120;
const OPAQUE_CURSOR_PREFIX = 'v2';

type ListingSortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
type ManualListingCursor = {
  sortBy: ListingSortOption;
  metric: number;
  id: string;
};

function isLegacyOffsetCursor(cursor: string) {
  return /^[0-9]+$/.test(cursor);
}

function isDescendingSort(sortBy: ListingSortOption) {
  return sortBy === 'newest' || sortBy === 'price_desc';
}

function getSortMetric(listing: Doc<'listings'>, sortBy: ListingSortOption) {
  return sortBy === 'price_asc' || sortBy === 'price_desc' ? listing.price : listing.createdAt;
}

function compareListingsBySort(a: Doc<'listings'>, b: Doc<'listings'>, sortBy: ListingSortOption) {
  const metricDiff = getSortMetric(a, sortBy) - getSortMetric(b, sortBy);
  if (metricDiff !== 0) {
    return isDescendingSort(sortBy) ? -metricDiff : metricDiff;
  }

  if (a._id === b._id) {
    return 0;
  }

  // Stable tie-break by id so cursor pagination does not duplicate/skip on ties.
  if (isDescendingSort(sortBy)) {
    return a._id < b._id ? 1 : -1;
  }
  return a._id < b._id ? -1 : 1;
}

function encodeManualCursor(sortBy: ListingSortOption, listing: Doc<'listings'>) {
  return `${OPAQUE_CURSOR_PREFIX}|${sortBy}|${getSortMetric(listing, sortBy)}|${listing._id}`;
}

function parseManualCursor(cursor: string): ManualListingCursor {
  const parts = cursor.split('|');
  if (parts.length !== 4 || parts[0] !== OPAQUE_CURSOR_PREFIX) {
    throw new ConvexError('cursor must be a non-negative integer string or null');
  }

  const sortBy = parts[1] as ListingSortOption;
  if (!['newest', 'oldest', 'price_asc', 'price_desc'].includes(sortBy)) {
    throw new ConvexError('cursor must be a non-negative integer string or null');
  }

  const metric = Number.parseFloat(parts[2]);
  if (!Number.isFinite(metric) || parts[3].length === 0) {
    throw new ConvexError('cursor must be a non-negative integer string or null');
  }

  return { sortBy, metric, id: parts[3] };
}

function isAfterManualCursor(listing: Doc<'listings'>, cursor: ManualListingCursor) {
  const metric = getSortMetric(listing, cursor.sortBy);
  if (isDescendingSort(cursor.sortBy)) {
    if (metric < cursor.metric) return true;
    if (metric > cursor.metric) return false;
    return listing._id < cursor.id;
  }
  if (metric > cursor.metric) return true;
  if (metric < cursor.metric) return false;
  return listing._id > cursor.id;
}

function paginateManualSortedListings(args: {
  listings: Doc<'listings'>[];
  sortBy: ListingSortOption;
  paginationOpts: { numItems: number; cursor: string | null };
}) {
  const requestedItems = args.paginationOpts.numItems;
  const { cursor } = args.paginationOpts;

  if (cursor && isLegacyOffsetCursor(cursor)) {
    // Backward compatibility for existing offset cursors.
    const startIndex = Number.parseInt(cursor, 10);
    const endIndex = startIndex + requestedItems;
    const page = args.listings.slice(startIndex, endIndex);
    const hasMore = endIndex < args.listings.length;
    return {
      page,
      continueCursor: hasMore ? String(endIndex) : null,
      isDone: !hasMore,
    };
  }

  let scoped = args.listings;
  if (cursor) {
    const parsed = parseManualCursor(cursor);
    if (parsed.sortBy !== args.sortBy) {
      throw new ConvexError('cursor must be a non-negative integer string or null');
    }
    scoped = args.listings.filter((listing) => isAfterManualCursor(listing, parsed));
  }

  const page = scoped.slice(0, requestedItems);
  const hasMore = scoped.length > requestedItems;
  return {
    page,
    continueCursor:
      hasMore && page.length > 0 ? encodeManualCursor(args.sortBy, page[page.length - 1]) : null,
    isDone: !hasMore,
  };
}

function validatePaginationOrThrow(paginationOpts: { numItems: number; cursor: string | null }) {
  if (paginationOpts.numItems < 1 || paginationOpts.numItems > MAX_PAGE_SIZE) {
    throw new ConvexError(`numItems must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  if (paginationOpts.cursor !== null) {
    if (isLegacyOffsetCursor(paginationOpts.cursor)) {
      return;
    }
    if (!paginationOpts.cursor.startsWith(`${OPAQUE_CURSOR_PREFIX}|`)) {
      throw new ConvexError('cursor must be a non-negative integer string or null');
    }
    parseManualCursor(paginationOpts.cursor);
  }
}

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

export const generateListingImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to upload images');
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const getListingImageUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

function normalizeSearchTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(
          (tag) =>
            tag.length >= TAG_CONSTRAINTS.MIN_TAG_LENGTH &&
            tag.length <= TAG_CONSTRAINTS.MAX_TAG_LENGTH
        )
    ),
  ].slice(0, TAG_CONSTRAINTS.MAX_TAGS);
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
        tags: v.optional(v.array(v.string())),
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
    validatePaginationOrThrow(args.paginationOpts);

    const filters = args.filters ?? {};
    const searchTerm = filters.searchTerm?.trim();
    const sortBy = filters.sortBy ?? 'newest';

    if (searchTerm && searchTerm.length > MAX_SEARCH_TERM_LENGTH) {
      throw new ConvexError(`searchTerm must be <= ${MAX_SEARCH_TERM_LENGTH} characters`);
    }

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

      const MAX_SEARCH_COLLECT = MAX_MANUAL_COLLECT;
      // For search queries, we must collect since search indexes don't support paginate()
      let results = await searchQuery.take(MAX_SEARCH_COLLECT);
      // Detect scan ceiling: if we got exactly MAX_SEARCH_COLLECT rows the true result
      // set may be larger. Signal this to callers so the UI can warn the user.
      const resultsTruncated = results.length === MAX_SEARCH_COLLECT;

      // Apply price range filters in memory (search indexes don't support range queries)
      if (filters.minPrice !== undefined) {
        results = results.filter((l) => l.price >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        results = results.filter((l) => l.price <= filters.maxPrice!);
      }

      // Filter out hidden content
      results = results.filter((l) => l.isHidden !== true);

      const sortedResults = [...results].sort((a, b) => compareListingsBySort(a, b, sortBy));
      const manualPage = paginateManualSortedListings({
        listings: sortedResults,
        sortBy,
        paginationOpts: args.paginationOpts,
      });

      return {
        page: manualPage.page,
        continueCursor: manualPage.continueCursor,
        isDone: manualPage.isDone,
        resultsTruncated,
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
        resultsTruncated: false,
      };
    }

    // Need post-filtering: collect with limit, filter, then paginate in-memory
    // This is necessary because filters can't be expressed in indexes
    const MAX_COLLECT = MAX_MANUAL_COLLECT; // Limit to prevent excessive memory usage

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

    const sortedFiltered = [...filtered].sort((a, b) => compareListingsBySort(a, b, sortBy));
    const manualPage = paginateManualSortedListings({
      listings: sortedFiltered,
      sortBy,
      paginationOpts: args.paginationOpts,
    });
    // Detect scan ceiling for this filter branch.
    const resultsTruncated = allResults.length === MAX_COLLECT;

    return {
      page: manualPage.page,
      continueCursor: manualPage.continueCursor,
      isDone: manualPage.isDone,
      resultsTruncated,
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
    validatePaginationOrThrow(args.paginationOpts);

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
        resultsTruncated: false,
      };
    }

    // Need tags/price filtering: collect with limit, filter, then paginate in-memory
    // This is necessary because filters can't be expressed in indexes
    const MAX_COLLECT = MAX_MANUAL_COLLECT; // Limit to prevent excessive memory usage

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

    const sortedFiltered = [...filtered].sort((a, b) => compareListingsBySort(a, b, 'newest'));
    const manualPage = paginateManualSortedListings({
      listings: sortedFiltered,
      sortBy: 'newest',
      paginationOpts: args.paginationOpts,
    });
    // Detect scan ceiling for this filter branch.
    const resultsTruncated = allResults.length === MAX_COLLECT;

    return {
      page: manualPage.page,
      continueCursor: manualPage.continueCursor,
      isDone: manualPage.isDone,
      resultsTruncated,
    };
  },
});

// Internal query for fetching a listing (used by actions for ownership checks)
export const internalGetListing = internalQuery({
  args: { id: v.id('listings') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query for checking user profile (used by createListing action)
export const internalGetProfile = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique();
  },
});

// Internal mutation: persists a new listing (called by createListing action after moderation)
export const internalCreateListing = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: categoryValidator,
    images: v.array(v.string()),
    condition: conditionValidator,
    tags: v.optional(v.array(v.string())),
    sellerId: v.string(),
    sellerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Defense-in-depth: verify sellerEmail is a Cal Poly address if supplied.
    // The OTP flow already enforces this, but guard here too so the field can
    // never be written with an invalid domain (e.g. via internal callers).
    if (args.sellerEmail && !isCalPolyEmail(args.sellerEmail)) {
      throw new ConvexError('Seller email must be a @calpoly.edu address');
    }
    const now = Date.now();
    const listingId = await ctx.db.insert('listings', {
      title: args.title,
      description: args.description,
      price: args.price,
      category: args.category,
      images: args.images,
      condition: args.condition,
      tags: args.tags,
      sellerId: args.sellerId,
      sellerEmail: args.sellerEmail,
      status: 'active',
      createdAt: now,
      postedOn: now,
    });
    return listingId;
  },
});

// Create a new listing (action — screens content via moderation before persisting)
export const createListing = action({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: categoryValidator,
    images: v.array(v.string()),
    condition: conditionValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to create a listing');
    }

    // Verify user has completed profile setup
    const userProfile = await ctx.runQuery(internal.listings.internalGetProfile, {
      userId: identity.subject,
    });
    if (!userProfile) {
      throw new ConvexError('You must complete your profile setup before creating a listing');
    }

    // Validate inputs
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

    // Screen content via OpenAI Moderation API
    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: validatedTitle + ' ' + args.description,
      contentType: 'listing',
      userId: identity.subject,
    });

    if (moderationResult.flagged) {
      throw new ConvexError(
        'Your listing contains content that violates our community guidelines. Please revise and try again.'
      );
    }

    // Persist via internal mutation
    const listingId = await ctx.runMutation(internal.listings.internalCreateListing, {
      title: validatedTitle,
      description: args.description,
      price: args.price,
      category: args.category,
      images: args.images,
      condition: args.condition,
      tags: normalizedTags,
      sellerId: identity.subject,
      sellerEmail: identity.email ?? undefined,
    });

    if (moderationResult.degraded) {
      try {
        await ctx.runMutation(internal.moderation.enqueueShadowModeration, {
          contentType: 'listing',
          contentId: listingId,
          userId: identity.subject,
          reason: moderationResult.degradeReason ?? 'provider_degraded',
        });
      } catch (error) {
        // Keep listing creation fail-open even if queueing fails.
        console.warn('[moderation] unable to enqueue shadow moderation for listing create:', error);
      }
    }

    return listingId;
  },
});

// Internal mutation: patches an existing listing (called by updateListing action after moderation)
export const internalUpdateListing = internalMutation({
  args: {
    id: v.id('listings'),
    update: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      price: v.optional(v.number()),
      images: v.optional(v.array(v.string())),
      condition: v.optional(conditionValidator),
      category: v.optional(categoryValidator),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    // Build a clean update object (strip undefined fields)
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args.update)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const updateListing = action({
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
  handler: async (ctx, args): Promise<void> => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to perform this action');
    }

    // Ownership check via internal query (actions can't read DB directly)
    const listing = await ctx.runQuery(internal.listings.internalGetListing, { id: args.id });
    if (!listing) {
      throw new ConvexError('Listing not found');
    }
    if (listing.sellerId !== identity.subject) {
      throw new ConvexError('You are not the owner of this listing');
    }
    if (listing.status === 'deleted') {
      throw new ConvexError('Cannot update a deleted listing');
    }

    // Validate inputs
    const update: Record<string, unknown> = {};

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

    // Screen updated text content via moderation
    const titleToCheck = (update.title as string) ?? listing.title;
    const descToCheck = (update.description as string) ?? listing.description;

    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: titleToCheck + ' ' + descToCheck,
      contentType: 'listing',
      userId: identity.subject,
      contentId: args.id,
    });

    if (moderationResult.flagged) {
      throw new ConvexError(
        'Your listing contains content that violates our community guidelines. Please revise and try again.'
      );
    }

    // Persist via internal mutation
    await ctx.runMutation(internal.listings.internalUpdateListing, {
      id: args.id,
      update: {
        title: update.title as string | undefined,
        description: update.description as string | undefined,
        price: update.price as number | undefined,
        images: update.images as string[] | undefined,
        condition: update.condition as 'new' | 'used' | 'refurbished' | undefined,
        category: update.category as
          | 'textbooks'
          | 'electronics'
          | 'furniture'
          | 'tickets'
          | 'other'
          | undefined,
        tags: update.tags as string[] | undefined,
      },
    });

    if (moderationResult.degraded) {
      try {
        await ctx.runMutation(internal.moderation.enqueueShadowModeration, {
          contentType: 'listing',
          contentId: args.id,
          userId: identity.subject,
          reason: moderationResult.degradeReason ?? 'provider_degraded',
        });
      } catch (error) {
        // Keep listing updates fail-open even if queueing fails.
        console.warn('[moderation] unable to enqueue shadow moderation for listing update:', error);
      }
    }
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
      .withIndex('by_seller', (q) => q.eq('sellerId', identity.subject))
      .filter((q) => q.eq(q.field('isHidden'), true))
      .take(200);
  },
});

// Get current user's own listings (all non-deleted statuses)
// Capped at 200 — per DECISIONS.md, avoid unbounded reads. 200 own listings is a generous ceiling.
export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to view your listings');
    }
    return await ctx.db
      .query('listings')
      .withIndex('by_seller', (q) => q.eq('sellerId', identity.subject))
      .filter((q) => q.neq(q.field('status'), 'deleted'))
      .order('desc')
      .take(200);
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

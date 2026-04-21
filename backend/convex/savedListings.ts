import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';
import { requireAuthUserId, getStableUserId } from './lib/authIdentity';

const MAX_SAVED_STATE_LISTING_IDS = 100;

function isListingUnavailable(listing: Doc<'listings'>): boolean {
  return (
    listing.status === 'deleted' ||
    listing.status === 'inactive' ||
    listing.status === 'sold' ||
    listing.isHidden === true
  );
}

function shouldHideSavedListingDetails(listing: Doc<'listings'>): boolean {
  return listing.status === 'deleted' || listing.isHidden === true;
}

export const toggleSavedListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx, 'You must be logged in to save listings');

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new ConvexError('Listing not found');
    }

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) => q.eq('userId', userId).eq('listingId', args.listingId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    await ctx.db.insert('savedListings', {
      userId,
      listingId: args.listingId,
      createdAt: Date.now(),
    });
    return { saved: true };
  },
});

export const saveListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx, 'You must be logged in to save listings');

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new ConvexError('Listing not found');
    }

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) => q.eq('userId', userId).eq('listingId', args.listingId))
      .unique();

    if (existing) {
      return;
    }

    await ctx.db.insert('savedListings', {
      userId,
      listingId: args.listingId,
      createdAt: Date.now(),
    });
  },
});

export const unsaveListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx, 'You must be logged in to unsave listings');

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) => q.eq('userId', userId).eq('listingId', args.listingId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const isListingSaved = query({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const userId = await getStableUserId(ctx);
    if (!userId) return false;

    const saved = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) => q.eq('userId', userId).eq('listingId', args.listingId))
      .unique();

    return !!saved;
  },
});

export const getSavedStateForListings = query({
  args: { listingIds: v.array(v.id('listings')) },
  handler: async (ctx, args) => {
    const userId = await getStableUserId(ctx);
    if (!userId || args.listingIds.length === 0) {
      return {} as Record<string, boolean>;
    }
    if (args.listingIds.length > MAX_SAVED_STATE_LISTING_IDS) {
      throw new ConvexError(
        `listingIds must contain at most ${MAX_SAVED_STATE_LISTING_IDS} entries`
      );
    }

    const result: Record<string, boolean> = {};
    for (const id of new Set(args.listingIds)) {
      const saved = await ctx.db
        .query('savedListings')
        .withIndex('by_user_listing', (q) => q.eq('userId', userId).eq('listingId', id))
        .unique();
      result[id] = !!saved;
    }
    return result;
  },
});

type PublicListing = {
  _id: Id<'listings'>;
  title: string;
  description: string;
  price: number;
  sellerId: string;
  images: string[];
  condition: Doc<'listings'>['condition'];
  category: Doc<'listings'>['category'];
  status: Doc<'listings'>['status'];
  createdAt: number;
  postedOn: number;
};

function toPublicListing(listing: Doc<'listings'>): PublicListing {
  return {
    _id: listing._id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    sellerId: listing.sellerId,
    images: listing.images,
    condition: listing.condition,
    category: listing.category,
    status: listing.status,
    createdAt: listing.createdAt,
    postedOn: listing.postedOn,
  };
}

export type SavedListingItem = {
  _id: Id<'savedListings'>;
  listingId: Id<'listings'>;
  createdAt: number;
  listing: PublicListing | null;
  isUnavailable: boolean;
};

export const getMySavedListings = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx, 'You must be logged in to view saved listings');

    const result = await ctx.db
      .query('savedListings')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate(args.paginationOpts);

    const resolvedItems: SavedListingItem[] = [];
    for (const saved of result.page) {
      const listingDoc = await ctx.db.get(saved.listingId);
      if (listingDoc && shouldHideSavedListingDetails(listingDoc)) {
        continue;
      }
      resolvedItems.push({
        _id: saved._id,
        listingId: saved.listingId,
        createdAt: saved.createdAt,
        listing: listingDoc ? toPublicListing(listingDoc) : null,
        isUnavailable: listingDoc ? isListingUnavailable(listingDoc) : true,
      });
    }

    return {
      page: resolvedItems,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

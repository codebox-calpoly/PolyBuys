import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';

function isListingUnavailable(listing: Doc<'listings'>): boolean {
  return (
    listing.status === 'deleted' ||
    listing.status === 'inactive' ||
    listing.status === 'sold' ||
    listing.isHidden === true
  );
}

export const toggleSavedListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to save listings');
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new ConvexError('Listing not found');
    }

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) =>
        q.eq('userId', identity.subject).eq('listingId', args.listingId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    await ctx.db.insert('savedListings', {
      userId: identity.subject,
      listingId: args.listingId,
      createdAt: Date.now(),
    });
    return { saved: true };
  },
});

export const saveListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to save listings');
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new ConvexError('Listing not found');
    }

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) =>
        q.eq('userId', identity.subject).eq('listingId', args.listingId)
      )
      .unique();

    if (existing) {
      return;
    }

    await ctx.db.insert('savedListings', {
      userId: identity.subject,
      listingId: args.listingId,
      createdAt: Date.now(),
    });
  },
});

export const unsaveListing = mutation({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to unsave listings');
    }

    const existing = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) =>
        q.eq('userId', identity.subject).eq('listingId', args.listingId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const isListingSaved = query({
  args: { listingId: v.id('listings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const saved = await ctx.db
      .query('savedListings')
      .withIndex('by_user_listing', (q) =>
        q.eq('userId', identity.subject).eq('listingId', args.listingId)
      )
      .unique();

    return !!saved;
  },
});

export const getSavedStateForListings = query({
  args: { listingIds: v.array(v.id('listings')) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || args.listingIds.length === 0) {
      return {} as Record<string, boolean>;
    }

    const saved = await ctx.db
      .query('savedListings')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', identity.subject))
      .collect();

    const savedSet = new Set(saved.map((s) => s.listingId));
    const result: Record<string, boolean> = {};
    for (const id of args.listingIds) {
      result[id] = savedSet.has(id);
    }
    return result;
  },
});

export type SavedListingItem = {
  _id: Id<'savedListings'>;
  listingId: Id<'listings'>;
  createdAt: number;
  listing: Doc<'listings'> | null;
  isUnavailable: boolean;
};

export const getMySavedListings = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to view saved listings');
    }

    const result = await ctx.db
      .query('savedListings')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .paginate(args.paginationOpts);

    const resolvedItems: SavedListingItem[] = [];
    for (const saved of result.page) {
      const listingDoc = await ctx.db.get(saved.listingId);
      resolvedItems.push({
        _id: saved._id,
        listingId: saved.listingId,
        createdAt: saved.createdAt,
        listing: listingDoc,
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

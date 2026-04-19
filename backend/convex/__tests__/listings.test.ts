// backend/convex/__tests__/listings.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
import * as listingsModule from '../listings';
import * as profilesModule from '../profiles';
import * as usersModule from '../users';
import * as messagesModule from '../messages';
import * as moderationModule from '../moderation';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';

// Import all Convex function modules so convex-test can run them.
// In Jest, we use direct imports instead of import.meta.glob
// Wrap modules in functions to match the expected format
const modules = {
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../profiles.ts': () => Promise.resolve(profilesModule),
  '../users.ts': () => Promise.resolve(usersModule),
  '../messages.ts': () => Promise.resolve(messagesModule),
  '../moderation.ts': () => Promise.resolve(moderationModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

// Mock global fetch for OpenAI Moderation API calls
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    }),
  }) as any;
});

afterEach(() => {
  global.fetch = originalFetch;
});

// Helper: base valid args for createListing
const baseArgs = {
  title: 'Great textbook for CSC 202',
  description: 'Gently used, highlights in a few chapters.',
  price: 50,
  category: 'textbooks' as const,
  images: ['https://example.com/book1.png'],
  condition: 'used' as const,
};

const aliceIdentity = { name: 'Alice', subject: 'alice-id', email: 'alice@calpoly.edu' };
const ownerIdentity = { name: 'Owner', subject: 'owner-id', email: 'owner@calpoly.edu' };
const otherIdentity = { name: 'Other', subject: 'other-id', email: 'other@calpoly.edu' };

// Helper for pagination opts in tests
const defaultPaginationOpts = { numItems: 100, cursor: null };

/**
 * Helper to create a test instance with profiles for common test identities
 */
async function setupTestWithProfiles() {
  const t = convexTest(schema as any, modules);

  // Create profiles for all common test identities
  await t.run(async (ctx: any) => {
    await ctx.db.insert('profiles', {
      userId: aliceIdentity.subject,
      name: aliceIdentity.name,
      email: aliceIdentity.email,
      major: 'Computer Science',
      year: 2025,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });

    await ctx.db.insert('profiles', {
      userId: ownerIdentity.subject,
      name: ownerIdentity.name,
      email: ownerIdentity.email,
      major: 'Computer Science',
      year: 2025,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });

    await ctx.db.insert('profiles', {
      userId: otherIdentity.subject,
      name: otherIdentity.name,
      email: otherIdentity.email,
      major: 'Computer Science',
      year: 2025,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });
  });

  return t;
}

describe('Listings mutations', () => {
  it('createListing succeeds with valid data', async () => {
    const t = await setupTestWithProfiles();

    // Simulate an authenticated user
    const asUser = t.withIdentity(aliceIdentity);

    const listingId = await asUser.action(api.listings.createListing, baseArgs);

    // Look up the listing directly in the mock DB
    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toMatchObject({
      title: baseArgs.title,
      description: baseArgs.description,
      price: baseArgs.price,
      category: baseArgs.category,
      status: 'active',
      sellerId: 'alice-id',
    });

    // Extra checks: images + postedOn/createdAt exist
    expect(listing?.images).toHaveLength(1);
    expect(typeof listing?.createdAt).toBe('number');
    expect(typeof listing?.postedOn).toBe('number');
  });

  it('createListing fails when title is too short', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        title: 'Hey', // 3 chars, too short
      });
    }).rejects.toThrowError('Title must be 5-100 characters');
  });

  it('createListing fails when images array is empty', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        images: [],
      });
    }).rejects.toThrowError('Must have 1-8 images');
  });

  it('createListing fails when images array is too long', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    const tooManyImages = Array.from({ length: 9 }, (_, i) => `https://example.com/img${i}.png`);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        images: tooManyImages,
      });
    }).rejects.toThrowError('Must have 1-8 images');
  });

  it('createListing fails when price is negative', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        price: -1,
      });
    }).rejects.toThrowError('Price must be non-negative');
  });

  it('createListing fails when user has not completed profile setup', async () => {
    const t = await setupTestWithProfiles();
    const asUserWithoutProfile = t.withIdentity({
      name: 'NoProfile',
      subject: 'no-profile-id',
      email: 'noprfile@calpoly.edu',
    });

    await expect(async () => {
      await asUserWithoutProfile.action(api.listings.createListing, baseArgs);
    }).rejects.toThrowError('You must complete your profile setup before creating a listing');
  });

  it('updateListing allows the owner to update fields', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    // Create listing as owner
    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    // Update the title and price
    await asOwner.action(api.listings.updateListing, {
      id: listingId,
      title: 'Updated listing title',
      price: 75,
    });

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(updated).toMatchObject({
      title: 'Updated listing title',
      price: 75,
      sellerId: 'owner-id',
    });
  });

  it('updateListing rejects updates from non-owner', async () => {
    const t = await setupTestWithProfiles();

    const asOwner = t.withIdentity(ownerIdentity);
    const asOtherUser = t.withIdentity(otherIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOtherUser.action(api.listings.updateListing, {
        id: listingId,
        title: 'Hacked title',
      });
    }).rejects.toThrowError('You are not the owner of this listing');
  });

  it('deleteListing performs a soft delete by setting status to deleted', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.deleteListing, { id: listingId });

    const deleted = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(deleted?.status).toBe('deleted');
  });

  it('updateListing cannot update a deleted listing', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.deleteListing, { id: listingId });

    await expect(async () => {
      await asOwner.action(api.listings.updateListing, {
        id: listingId,
        title: 'New title after delete',
      });
    }).rejects.toThrowError('Cannot update a deleted listing');
  });

  it('updateListing cannot update a sold listing', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.updateListingStatus, {
      id: listingId,
      status: 'sold',
    });

    await expect(async () => {
      await asOwner.action(api.listings.updateListing, {
        id: listingId,
        title: 'Post-sale retitle',
      });
    }).rejects.toThrowError('Cannot update a sold listing');
  });

  it('internalUpdateListing cannot patch a listing after it becomes sold', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.updateListingStatus, {
      id: listingId,
      status: 'sold',
    });

    await expect(async () => {
      await t.mutation(internal.listings.internalUpdateListing, {
        id: listingId,
        update: {
          title: 'Stale write after sold',
        },
      });
    }).rejects.toThrowError('Cannot update a sold listing');
  });

  it('updateListingStatus cannot change status of a deleted listing', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.deleteListing, { id: listingId });

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListingStatus, {
        id: listingId,
        status: 'active',
      });
    }).rejects.toThrowError('Cannot change status of a deleted listing');
  });

  it('updateListingStatus cannot change status of a sold listing (one-way sold)', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);
    await asOwner.mutation(api.listings.updateListingStatus, { id: listingId, status: 'sold' });

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListingStatus, {
        id: listingId,
        status: 'active',
      });
    }).rejects.toThrowError('Cannot change status of a sold listing');

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListingStatus, {
        id: listingId,
        status: 'inactive',
      });
    }).rejects.toThrowError('Cannot change status of a sold listing');
  });

  it('sold listings are excluded from getListings discovery', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);
    await asOwner.mutation(api.listings.updateListingStatus, { id: listingId, status: 'sold' });

    const result = await t.query(api.listings.getListings, {
      paginationOpts: { numItems: 100, cursor: null },
    });

    const ids = result.page.map((l: { _id: string }) => l._id);
    expect(ids).not.toContain(listingId);
  });
});

describe('Listings queries', () => {
  it('returns listings newest first', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    // Create listings with slight delay simulation
    const id1 = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'First listing created',
      price: 10,
    });
    const id2 = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Second listing created',
      price: 20,
    });

    const result = await t.query(api.listings.getListings, {
      paginationOpts: defaultPaginationOpts,
    });
    const listings = result.page;

    // Newest should be first (id2 created after id1)
    expect(listings.length).toBeGreaterThanOrEqual(2);
    const ids = listings.map((l: any) => l._id);
    expect(ids.indexOf(id2)).toBeLessThan(ids.indexOf(id1));
  });

  it('filters by category', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      category: 'textbooks',
      title: 'A Textbook Item',
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      category: 'electronics',
      title: 'An Electronics Item',
    });

    const textbookListings = await t.query(api.listings.getListings, {
      category: 'textbooks',
      paginationOpts: defaultPaginationOpts,
    });
    const electronicsListings = await t.query(api.listings.getListings, {
      category: 'electronics',
      paginationOpts: defaultPaginationOpts,
    });

    expect(textbookListings.page.every((l: any) => l.category === 'textbooks')).toBe(true);
    expect(electronicsListings.page.every((l: any) => l.category === 'electronics')).toBe(true);
  });

  it('hides reported-conversation listing from reporter in getListings only', async () => {
    const t = await setupTestWithProfiles();
    const asSeller = t.withIdentity(ownerIdentity);
    const asBuyer = t.withIdentity(aliceIdentity);
    const asOther = t.withIdentity(otherIdentity);

    const listingId = await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Reported conversation listing',
    });

    const { conversationId } = await asBuyer.mutation(api.messages.getOrCreateConversation, {
      listingId,
    });

    await asBuyer.mutation(api.messages.reportConversation, {
      conversationId,
      reason: 'spam',
    });

    const buyerFeed = await asBuyer.query(api.listings.getListings, {
      paginationOpts: defaultPaginationOpts,
    });
    const otherFeed = await asOther.query(api.listings.getListings, {
      paginationOpts: defaultPaginationOpts,
    });

    expect(buyerFeed.page.map((listing: any) => listing._id)).not.toContain(listingId);
    expect(otherFeed.page.map((listing: any) => listing._id)).toContain(listingId);
  });

  it('hides reported-conversation listing from reporter in searchAndFilterListings only', async () => {
    const t = await setupTestWithProfiles();
    const asSeller = t.withIdentity(ownerIdentity);
    const asBuyer = t.withIdentity(aliceIdentity);
    const asOther = t.withIdentity(otherIdentity);

    const listingId = await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Unique Report Search Token',
    });

    const { conversationId } = await asBuyer.mutation(api.messages.getOrCreateConversation, {
      listingId,
    });

    await asBuyer.mutation(api.messages.reportConversation, {
      conversationId,
      reason: 'inappropriate',
    });

    const buyerSearch = await asBuyer.query(api.listings.searchAndFilterListings, {
      filters: { searchTerm: 'Unique Report Search Token' },
      paginationOpts: defaultPaginationOpts,
    });
    const otherSearch = await asOther.query(api.listings.searchAndFilterListings, {
      filters: { searchTerm: 'Unique Report Search Token' },
      paginationOpts: defaultPaginationOpts,
    });

    expect(buyerSearch.page.map((listing: any) => listing._id)).not.toContain(listingId);
    expect(otherSearch.page.map((listing: any) => listing._id)).toContain(listingId);
  });

  it('getListings keeps pages filled after excluding reported conversation listings', async () => {
    const t = await setupTestWithProfiles();
    const asSeller = t.withIdentity(ownerIdentity);
    const asBuyer = t.withIdentity(aliceIdentity);

    await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Visible older listing',
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Visible middle listing',
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const reportedListingId = await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Reported newest listing',
    });

    const { conversationId } = await asBuyer.mutation(api.messages.getOrCreateConversation, {
      listingId: reportedListingId,
    });
    await asBuyer.mutation(api.messages.reportConversation, {
      conversationId,
      reason: 'spam',
    });

    const page = await asBuyer.query(api.listings.getListings, {
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(page.page).toHaveLength(2);
    expect(page.page.map((listing: any) => listing._id)).not.toContain(reportedListingId);
  });

  it('searchAndFilterListings keeps pages filled after excluding reported conversation listings', async () => {
    const t = await setupTestWithProfiles();
    const asSeller = t.withIdentity(ownerIdentity);
    const asBuyer = t.withIdentity(aliceIdentity);

    await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Search visible older listing',
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Search visible middle listing',
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const reportedListingId = await asSeller.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Search reported newest listing',
    });

    const { conversationId } = await asBuyer.mutation(api.messages.getOrCreateConversation, {
      listingId: reportedListingId,
    });
    await asBuyer.mutation(api.messages.reportConversation, {
      conversationId,
      reason: 'inappropriate',
    });

    const page = await asBuyer.query(api.listings.searchAndFilterListings, {
      filters: { sortBy: 'newest' },
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(page.page).toHaveLength(2);
    expect(page.page.map((listing: any) => listing._id)).not.toContain(reportedListingId);
  });

  it('filters by minPrice', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Cheap item cheap',
      price: 10,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Expensive item',
      price: 100,
    });

    const filtered = await t.query(api.listings.getListings, {
      minPrice: 50,
      paginationOpts: defaultPaginationOpts,
    });

    expect(filtered.page.every((l: any) => l.price >= 50)).toBe(true);
  });

  it('filters by maxPrice', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Cheap item pric',
      price: 10,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Expensive price',
      price: 100,
    });

    const filtered = await t.query(api.listings.getListings, {
      maxPrice: 50,
      paginationOpts: defaultPaginationOpts,
    });

    expect(filtered.page.every((l: any) => l.price <= 50)).toBe(true);
  });

  it('combines category and price filters', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      category: 'furniture',
      title: 'Cheap furniture',
      price: 25,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      category: 'furniture',
      title: 'Expensive furniture',
      price: 200,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      category: 'electronics',
      title: 'Cheap electronics',
      price: 25,
    });

    const filtered = await t.query(api.listings.getListings, {
      category: 'furniture',
      maxPrice: 100,
      paginationOpts: defaultPaginationOpts,
    });

    expect(filtered.page.length).toBe(1);
    expect(filtered.page[0].title).toBe('Cheap furniture');
  });

  it('rejects invalid minPrice', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.getListings, {
        minPrice: -10,
        paginationOpts: defaultPaginationOpts,
      });
    }).rejects.toThrowError('minPrice must be non-negative');
  });

  it('rejects maxPrice less than minPrice', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.getListings, {
        minPrice: 100,
        maxPrice: 50,
        paginationOpts: defaultPaginationOpts,
      });
    }).rejects.toThrowError('maxPrice must be greater than or equal to minPrice');
  });

  it('non-owner cannot view sold, inactive, or deleted listings via getListing', async () => {
    const t = await setupTestWithProfiles();
    const owner = t.withIdentity(ownerIdentity);
    const nonOwner = t.withIdentity(otherIdentity);

    const soldId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Sold Listing',
    });
    await owner.mutation(api.listings.updateListingStatus, { id: soldId, status: 'sold' });

    const inactiveId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Inactive Listing',
    });
    await owner.mutation(api.listings.updateListingStatus, { id: inactiveId, status: 'inactive' });

    const deletedId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Deleted Listing',
    });
    await owner.mutation(api.listings.deleteListing, { id: deletedId });

    expect(await nonOwner.query(api.listings.getListing, { id: soldId })).toBeNull();
    expect(await nonOwner.query(api.listings.getListing, { id: inactiveId })).toBeNull();
    expect(await nonOwner.query(api.listings.getListing, { id: deletedId })).toBeNull();
  });

  it('owner can view own sold, inactive, and deleted listings via getListing', async () => {
    const t = await setupTestWithProfiles();
    const owner = t.withIdentity(ownerIdentity);

    const soldId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Owner Sold Listing',
    });
    await owner.mutation(api.listings.updateListingStatus, { id: soldId, status: 'sold' });

    const inactiveId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Owner Inactive Listing',
    });
    await owner.mutation(api.listings.updateListingStatus, { id: inactiveId, status: 'inactive' });

    const deletedId = await owner.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Owner Deleted Listing',
    });
    await owner.mutation(api.listings.deleteListing, { id: deletedId });

    const soldListing = await owner.query(api.listings.getListing, { id: soldId });
    const inactiveListing = await owner.query(api.listings.getListing, { id: inactiveId });
    const deletedListing = await owner.query(api.listings.getListing, { id: deletedId });

    expect(soldListing?.status).toBe('sold');
    expect(inactiveListing?.status).toBe('inactive');
    expect(deletedListing?.status).toBe('deleted');
  });
});

describe('Pagination bounds validation', () => {
  it('getListings rejects numItems > 100', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.getListings, {
        paginationOpts: { numItems: 101, cursor: null },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });

  it('getListings rejects numItems < 1', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.getListings, {
        paginationOpts: { numItems: 0, cursor: null },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });

  it('getListings accepts numItems = 1', async () => {
    const t = await setupTestWithProfiles();

    const result = await t.query(api.listings.getListings, {
      paginationOpts: { numItems: 1, cursor: null },
    });

    expect(result).toBeDefined();
    expect(result.page).toBeDefined();
  });

  it('getListings accepts numItems = 100', async () => {
    const t = await setupTestWithProfiles();

    const result = await t.query(api.listings.getListings, {
      paginationOpts: { numItems: 100, cursor: null },
    });

    expect(result).toBeDefined();
    expect(result.page).toBeDefined();
  });

  it('searchAndFilterListings rejects numItems > 100', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.searchAndFilterListings, {
        paginationOpts: { numItems: 101, cursor: null },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });

  it('searchAndFilterListings rejects numItems < 1', async () => {
    const t = await setupTestWithProfiles();

    await expect(async () => {
      await t.query(api.listings.searchAndFilterListings, {
        paginationOpts: { numItems: -5, cursor: null },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });
});

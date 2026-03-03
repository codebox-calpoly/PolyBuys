// backend/convex/__tests__/listings.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
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
  tags: ['csc202'],
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
      tags: baseArgs.tags,
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

  it('createListing normalizes tags to be trimmed and in lowercase', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    const unnormalized = '   fOUrTH EditION ';

    const listingId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      tags: [unnormalized],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition']);
  });

  it('createListing removes duplicate tags', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    const listingId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      tags: ['fourth edition', 'FOURTH EDITION', '   fourth edition    ', 'csc101'],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition', 'csc101']);
  });

  it('createListing fails when tags array is too long', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        tags: ['csc101', 'gently used', 'fourth edition', 'answers', 'textbook', 'hardcover'],
      });
    }).rejects.toThrowError('Maximum 5 tags allowed');
  });

  it('createListing fails when tag is empty', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        tags: [' '],
      });
    }).rejects.toThrowError('Empty tags are not allowed');
  });

  it('createListing fails when tag is >20 characters long', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    await expect(async () => {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        tags: ['supercalifragilisticexpialidocious'],
      });
    }).rejects.toThrowError('Tags must be 20 characters or less');
  });

  it('createListing succeeds with no tags', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    const listingId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      tags: [],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual([]);
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

  it('generateListingImageUploadUrl enforces per-user 15 minute rate limit', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);
    const now = Date.now();

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 30; i += 1) {
        await ctx.db.insert('imageUploadEvents', {
          userId: aliceIdentity.subject,
          eventType: 'issued',
          createdAt: now - i * 1000,
        });
      }
    });

    const result = await asUser.mutation(api.listings.generateListingImageUploadUrl, {});
    expect(result).toEqual({
      ok: false,
      message: 'Upload limit reached. Please wait a few minutes and try again.',
    });

    const blocked = await t.run(async (ctx: any) => {
      return await ctx.db
        .query('imageUploadEvents')
        .withIndex('by_user_type_createdAt', (q: any) =>
          q.eq('userId', aliceIdentity.subject).eq('eventType', 'blocked')
        )
        .order('desc')
        .take(1);
    });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].reason).toBe('rate_limit_15m');
  });

  it('generateListingImageUploadUrl enforces per-user daily rate limit', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);
    const now = Date.now();
    const sixteenMinutesMs = 16 * 60 * 1000;

    await t.run(async (ctx: any) => {
      for (let i = 0; i < 120; i += 1) {
        await ctx.db.insert('imageUploadEvents', {
          userId: aliceIdentity.subject,
          eventType: 'issued',
          createdAt: now - sixteenMinutesMs - i * 1000,
        });
      }
    });

    const result = await asUser.mutation(api.listings.generateListingImageUploadUrl, {});
    expect(result).toEqual({
      ok: false,
      message: 'Daily upload limit reached. Please try again tomorrow.',
    });

    const blocked = await t.run(async (ctx: any) => {
      return await ctx.db
        .query('imageUploadEvents')
        .withIndex('by_user_type_createdAt', (q: any) =>
          q.eq('userId', aliceIdentity.subject).eq('eventType', 'blocked')
        )
        .order('desc')
        .take(1);
    });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].reason).toBe('rate_limit_day');
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

  it('updateListing, normalizes tags to be trimmed and in lowercase', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const unnormalized = '   fOUrTH EditION ';

    const listingId = await asOwner.action(api.listings.createListing, {
      ...baseArgs,
      tags: [unnormalized],
    });

    await asOwner.action(api.listings.updateListing, {
      id: listingId,
      tags: ['   fOurTH EdiTIOn  '],
    });

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });
    expect(updated).toBeDefined();
    expect(updated?.tags).toEqual(['fourth edition']);
  });

  it('updateListing removes duplicate tags', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);
    await asOwner.action(api.listings.updateListing, {
      id: listingId,
      tags: ['fourth edition', 'FOURTH EDITION', '   fourth edition    ', 'csc101'],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition', 'csc101']);
  });

  it('updateListing fails when tags array is too long', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOwner.action(api.listings.updateListing, {
        id: listingId,
        tags: ['csc101', 'gently used', 'fourth edition', 'answers', 'textbook', 'hardcover'],
      });
    }).rejects.toThrowError('Maximum 5 tags allowed');
  });

  it('updateListing fails when tag is empty', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOwner.action(api.listings.updateListing, {
        id: listingId,
        tags: [' '],
      });
    }).rejects.toThrowError('Empty tags are not allowed');
  });

  it('updateListing fails when tag is >20 characters long', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    await expect(async () => {
      await asOwner.action(api.listings.createListing, {
        ...baseArgs,
        tags: ['supercalifragilisticexpialidocious'],
      });
    }).rejects.toThrowError('Tags must be 20 characters or less');
  });

  it('updateListing succeeds with no tags', async () => {
    const t = await setupTestWithProfiles();
    const asOwner = t.withIdentity(ownerIdentity);

    const listingId = await asOwner.action(api.listings.createListing, baseArgs);
    await asOwner.action(api.listings.updateListing, {
      id: listingId,
      tags: [],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId as any);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual([]);
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

  it('filters by tags and combines with category/price', async () => {
    const t = await setupTestWithProfiles();
    const asUser = t.withIdentity(aliceIdentity);

    const deskId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Wood Desk',
      price: 80,
      category: 'furniture',
      tags: ['desk', 'wood'],
    });

    const chairId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Wood Chair',
      price: 120,
      category: 'furniture',
      tags: ['chair', 'wood'],
    });

    const laptopId = await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Gaming Laptop',
      price: 900,
      category: 'electronics',
      tags: ['laptop', 'gaming'],
    });

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'CSC101 Book',
      price: 50,
      category: 'textbooks',
      tags: ['csc101'],
    });

    const ids = (result: { page: Array<{ _id: string }> }) =>
      result.page.map((listing) => listing._id).sort();

    const singleTag = await t.query(api.listings.getListings, {
      tags: ['desk'],
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(singleTag)).toEqual([deskId]);

    const multipleTags = await t.query(api.listings.getListings, {
      tags: ['desk', 'gaming'],
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(multipleTags)).toEqual([deskId, laptopId].sort());

    const tagAndCategory = await t.query(api.listings.getListings, {
      tags: ['wood'],
      category: 'furniture',
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(tagAndCategory)).toEqual([deskId, chairId].sort());

    const tagAndPrice = await t.query(api.listings.getListings, {
      tags: ['wood'],
      maxPrice: 100,
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(tagAndPrice)).toEqual([deskId]);

    const tagCategoryPrice = await t.query(api.listings.getListings, {
      tags: ['wood'],
      category: 'furniture',
      maxPrice: 100,
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(tagCategoryPrice)).toEqual([deskId]);

    const caseInsensitive = await t.query(api.listings.getListings, {
      tags: ['DeSk'],
      paginationOpts: defaultPaginationOpts,
    });
    expect(ids(caseInsensitive)).toEqual([deskId]);

    const noMatches = await t.query(api.listings.getListings, {
      tags: ['nonexistent'],
      paginationOpts: defaultPaginationOpts,
    });
    expect(noMatches.page).toEqual([]);
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

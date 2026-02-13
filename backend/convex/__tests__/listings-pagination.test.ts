// backend/convex/__tests__/listings-pagination.test.ts

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

const modules = {
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../profiles.ts': () => Promise.resolve(profilesModule),
  '../users.ts': () => Promise.resolve(usersModule),
  '../messages.ts': () => Promise.resolve(messagesModule),
  '../moderation.ts': () => Promise.resolve(moderationModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

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

/**
 * Helper to create a test instance with profile for Alice
 */
async function setupTestWithProfile() {
  const t = convexTest(schema as any, modules);

  // Create profile for Alice
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
  });

  return t;
}

describe('Filtered pagination correctness', () => {
  it('searchAndFilterListings with condition filter returns only matching condition', async () => {
    const t = await setupTestWithProfile();
    const asUser = t.withIdentity(aliceIdentity);

    // Create listings with different conditions
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'New Book',
      condition: 'new',
      price: 100,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Used Book',
      condition: 'used',
      price: 50,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Refurbished Book',
      condition: 'refurbished',
      price: 75,
    });

    // Search with price sort (uses price index) and condition filter
    const result = await t.query(api.listings.searchAndFilterListings, {
      filters: { condition: 'used', sortBy: 'price_asc' },
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.length).toBe(1);
    expect(result.page[0].condition).toBe('used');
    expect(result.page[0].title).toBe('Used Book');
  });

  it('searchAndFilterListings with condition in price_desc sort enforces filter', async () => {
    const t = await setupTestWithProfile();
    const asUser = t.withIdentity(aliceIdentity);

    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Expensive New',
      condition: 'new',
      price: 200,
    });
    await asUser.action(api.listings.createListing, {
      ...baseArgs,
      title: 'Expensive Used',
      condition: 'used',
      price: 150,
    });

    const result = await t.query(api.listings.searchAndFilterListings, {
      filters: { condition: 'new', sortBy: 'price_desc' },
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page.length).toBe(1);
    expect(result.page[0].condition).toBe('new');
    expect(result.page[0].price).toBe(200);
  });

  it('getListings pagination cursor advances correctly with tag filtering', async () => {
    const t = await setupTestWithProfile();
    const asUser = t.withIdentity(aliceIdentity);

    // Create multiple listings with same tag
    for (let i = 0; i < 5; i++) {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        title: `Tagged Listing ${i}`,
        tags: ['test-tag'],
      });
    }

    // Create listings without the tag
    for (let i = 0; i < 5; i++) {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        title: `Untagged Listing ${i}`,
        tags: ['other-tag'],
      });
    }

    // Fetch first page
    const page1 = await t.query(api.listings.getListings, {
      tags: ['test-tag'],
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(page1.page.length).toBe(2);
    expect(page1.isDone).toBe(false);
    expect(page1.continueCursor).not.toBeNull();

    // All results should have the tag
    page1.page.forEach((listing) => {
      expect(listing.tags).toContain('test-tag');
    });

    // Fetch second page
    const page2 = await t.query(api.listings.getListings, {
      tags: ['test-tag'],
      paginationOpts: { numItems: 2, cursor: page1.continueCursor },
    });

    expect(page2.page.length).toBe(2);
    page2.page.forEach((listing) => {
      expect(listing.tags).toContain('test-tag');
    });

    // Verify no duplicates between pages
    const page1Ids = page1.page.map((l) => l._id);
    const page2Ids = page2.page.map((l) => l._id);
    const intersection = page1Ids.filter((id) => page2Ids.includes(id));
    expect(intersection.length).toBe(0);
  });

  it('searchAndFilterListings pagination with maxPrice does not skip results', async () => {
    const t = await setupTestWithProfile();
    const asUser = t.withIdentity(aliceIdentity);

    // Create listings at various prices
    for (let i = 1; i <= 10; i++) {
      await asUser.action(api.listings.createListing, {
        ...baseArgs,
        title: `Listing ${i}`,
        price: i * 10,
      });
    }

    // Fetch with maxPrice filter, paginated
    const page1 = await t.query(api.listings.searchAndFilterListings, {
      filters: { maxPrice: 50 },
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(page1.page.length).toBe(2);
    page1.page.forEach((listing) => {
      expect(listing.price).toBeLessThanOrEqual(50);
    });

    // Fetch next page
    const page2 = await t.query(api.listings.searchAndFilterListings, {
      filters: { maxPrice: 50 },
      paginationOpts: { numItems: 2, cursor: page1.continueCursor },
    });

    expect(page2.page.length).toBe(2);
    page2.page.forEach((listing) => {
      expect(listing.price).toBeLessThanOrEqual(50);
    });

    // Verify no duplicates
    const page1Ids = page1.page.map((l) => l._id);
    const page2Ids = page2.page.map((l) => l._id);
    const intersection = page1Ids.filter((id) => page2Ids.includes(id));
    expect(intersection.length).toBe(0);
  });
});

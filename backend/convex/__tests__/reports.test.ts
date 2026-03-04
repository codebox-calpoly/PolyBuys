// backend/convex/__tests__/reports.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
import * as reportsModule from '../reports';
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

// Import all Convex function modules so convex-test can run them
const modules = {
  '../reports.ts': () => Promise.resolve(reportsModule),
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../profiles.ts': () => Promise.resolve(profilesModule),
  '../users.ts': () => Promise.resolve(usersModule),
  '../messages.ts': () => Promise.resolve(messagesModule),
  '../moderation.ts': () => Promise.resolve(moderationModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

describe('Reports mutations', () => {
  // Helper: create a test user
  const createTestUser = async (t: any, email: string) => {
    return await t.run(async (ctx: any) => {
      return await ctx.db.insert('users', {
        email,
        name: 'Test User',
        createdAt: Date.now(),
      });
    });
  };

  // Helper: create a test listing
  const createTestListing = async (t: any, sellerId: string) => {
    return await t.run(async (ctx: any) => {
      return await ctx.db.insert('listings', {
        title: 'Test Listing',
        description: 'A test listing',
        price: 50,
        sellerId,
        images: ['https://example.com/image.png'],
        condition: 'used',
        category: 'textbooks',
        status: 'active',
        createdAt: Date.now(),
        postedOn: Date.now(),
      });
    });
  };

  // Helper: create a test profile
  const createTestProfile = async (t: any, userId: string) => {
    return await t.run(async (ctx: any) => {
      return await ctx.db.insert('profiles', {
        userId,
        name: 'Test Profile',
        email: 'profile@calpoly.edu',
        joinDate: Date.now(),
        major: 'Computer Science',
        year: 2024,
        rating: 5,
        review_count: 0,
      });
    });
  };

  const createQualifiedReporterProfile = async (t: any, reporterId: string, email: string) => {
    const oneHourAgo = Date.now() - 2 * 60 * 60 * 1000;
    return await t.run(async (ctx: any) => {
      return await ctx.db.insert('profiles', {
        userId: reporterId,
        name: `Reporter ${reporterId}`,
        email,
        joinDate: oneHourAgo,
        major: 'Computer Science',
        year: 2024,
        rating: 5,
        review_count: 0,
      });
    });
  };

  it('createReport succeeds with valid listing report', async () => {
    const t = convexTest(schema as any, modules);

    // Create listing
    const listingId = await createTestListing(t, 'seller-id');

    // Simulate authenticated user
    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    // Create report
    const reportId = await asUser.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
      notes: 'This looks like a scam',
    });

    // Verify report was created
    const report = await t.run(async (ctx: any) => {
      return await ctx.db.get(reportId);
    });

    expect(report).toMatchObject({
      targetId: listingId,
      targetType: 'listing',
      reporterId: 'reporter-subject',
      reason: 'scam',
      notes: 'This looks like a scam',
    });
    expect(typeof report?.createdAt).toBe('number');
  });

  it('createReport succeeds with valid profile report', async () => {
    const t = convexTest(schema as any, modules);

    // Create profile
    const profileId = await createTestProfile(t, 'profile-user-id');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    // Create report
    const reportId = await asUser.mutation(api.reports.createReport, {
      targetId: profileId,
      targetType: 'profile',
      reason: 'inappropriate',
    });

    // Verify report was created
    const report = await t.run(async (ctx: any) => {
      return await ctx.db.get(reportId);
    });

    expect(report).toMatchObject({
      targetId: profileId,
      targetType: 'profile',
      reporterId: 'reporter-subject',
      reason: 'inappropriate',
    });
  });

  it('createReport fails when user is not authenticated', async () => {
    const t = convexTest(schema as any, modules);

    const listingId = await createTestListing(t, 'seller-id');

    await expect(async () => {
      await t.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'scam',
      });
    }).rejects.toThrow('You must be logged in to report content');
  });

  it('createReport rejects duplicate reports from same user', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');
    const listingId = await createTestListing(t, 'seller-id');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    // First report succeeds
    await asUser.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    // Second report from same user fails
    await expect(async () => {
      await asUser.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'spam',
      });
    }).rejects.toThrow('You have already reported this content');
  });

  it('createReport enforces rate limiting (10 reports per day)', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    // Create 10 different listings and report them all
    for (let i = 0; i < 10; i++) {
      const listingId = await createTestListing(t, `seller-${i}`);
      await asUser.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'spam',
      });
    }

    // 11th report should fail
    const listingId = await createTestListing(t, 'seller-11');
    await expect(async () => {
      await asUser.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'spam',
      });
    }).rejects.toThrow('Report limit reached. Please try again later.');
  });

  it('createReport throttles report floods on a single target', async () => {
    const t = convexTest(schema as any, modules);

    const listingId = await createTestListing(t, 'seller-id');

    for (let i = 0; i < 30; i += 1) {
      const reporterId = `reporter-${i}`;
      const reporterEmail = `reporter-${i}@calpoly.edu`;
      await createQualifiedReporterProfile(t, reporterId, reporterEmail);
      const asUser = t.withIdentity({
        name: `Reporter${i}`,
        subject: reporterId,
        email: reporterEmail,
      });
      await asUser.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'spam',
      });
    }

    await createQualifiedReporterProfile(t, 'reporter-31', 'reporter-31@calpoly.edu');
    const asUser31 = t.withIdentity({
      name: 'Reporter31',
      subject: 'reporter-31',
      email: 'reporter-31@calpoly.edu',
    });
    await expect(async () => {
      await asUser31.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'spam',
      });
    }).rejects.toThrow('This content is already under review. Please try again later.');
  });

  it('createReport rejects invalid listing targetId', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    await expect(async () => {
      await asUser.mutation(api.reports.createReport, {
        targetId: 'invalid_id_12345',
        targetType: 'listing',
        reason: 'scam',
      });
    }).rejects.toThrow('Listing not found');
  });

  it('createReport rejects invalid profile targetId', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    await expect(async () => {
      await asUser.mutation(api.reports.createReport, {
        targetId: 'invalid_id_12345',
        targetType: 'profile',
        reason: 'inappropriate',
      });
    }).rejects.toThrow('Profile not found');
  });

  it('createReport rejects notes exceeding character limit', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');
    const listingId = await createTestListing(t, 'seller-id');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    const longNotes = 'a'.repeat(501); // Exceeds 500 char limit

    await expect(async () => {
      await asUser.mutation(api.reports.createReport, {
        targetId: listingId,
        targetType: 'listing',
        reason: 'scam',
        notes: longNotes,
      });
    }).rejects.toThrow('Notes must be 500 characters or less');
  });

  it('createReport accepts notes within character limit', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter@calpoly.edu');
    const listingId = await createTestListing(t, 'seller-id');

    const asUser = t.withIdentity({
      name: 'Reporter',
      subject: 'reporter-subject',
      email: 'reporter@calpoly.edu',
    });

    const validNotes = 'a'.repeat(500); // Exactly 500 chars

    const reportId = await asUser.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
      notes: validNotes,
    });

    const report = await t.run(async (ctx: any) => {
      return await ctx.db.get(reportId);
    });

    expect(report?.notes).toBe(validNotes);
  });

  // Auto-hide functionality tests
  it('listing auto-hidden after 3rd unique report', async () => {
    const t = convexTest(schema as any, modules);

    // Create 3 different users
    await createTestUser(t, 'reporter1@calpoly.edu');
    await createTestUser(t, 'reporter2@calpoly.edu');
    await createTestUser(t, 'reporter3@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter1-subject', 'reporter1@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter2-subject', 'reporter2@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter3-subject', 'reporter3@calpoly.edu');

    const listingId = await createTestListing(t, 'seller-id');

    // Report from 3 different users
    const asUser1 = t.withIdentity({
      name: 'Reporter1',
      subject: 'reporter1-subject',
      email: 'reporter1@calpoly.edu',
    });
    await asUser1.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    const asUser2 = t.withIdentity({
      name: 'Reporter2',
      subject: 'reporter2-subject',
      email: 'reporter2@calpoly.edu',
    });
    await asUser2.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    const asUser3 = t.withIdentity({
      name: 'Reporter3',
      subject: 'reporter3-subject',
      email: 'reporter3@calpoly.edu',
    });
    await asUser3.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    // Check that listing is now hidden
    const listing = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });

    expect(listing?.isHidden).toBe(true);
    expect(listing?.hiddenReason).toBe('auto_moderation');
    expect(typeof listing?.hiddenAt).toBe('number');
  });

  it('listing NOT hidden after 2 unique reports (below threshold)', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter1@calpoly.edu');
    await createTestUser(t, 'reporter2@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter1-subject', 'reporter1@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter2-subject', 'reporter2@calpoly.edu');

    const listingId = await createTestListing(t, 'seller-id');

    const asUser1 = t.withIdentity({
      name: 'Reporter1',
      subject: 'reporter1-subject',
      email: 'reporter1@calpoly.edu',
    });
    await asUser1.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'spam',
    });

    const asUser2 = t.withIdentity({
      name: 'Reporter2',
      subject: 'reporter2-subject',
      email: 'reporter2@calpoly.edu',
    });
    await asUser2.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'spam',
    });

    // Check that listing is NOT hidden
    const listing = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });

    expect(listing?.isHidden).toBeUndefined();
  });

  it('auto-hide threshold counts unique reporters even if duplicate rows exist', async () => {
    const t = convexTest(schema as any, modules);

    const listingId = await createTestListing(t, 'seller-id');
    const now = Date.now();
    await createQualifiedReporterProfile(t, 'duplicate-reporter', 'duplicate@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter2-subject', 'reporter2@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter3-subject', 'reporter3@calpoly.edu');

    await t.run(async (ctx: any) => {
      await ctx.db.insert('reports', {
        targetId: listingId,
        targetType: 'listing',
        reporterId: 'duplicate-reporter',
        reportKey: `listing|${listingId}|duplicate-reporter`,
        reason: 'spam',
        createdAt: now - 2000,
      });
      await ctx.db.insert('reports', {
        targetId: listingId,
        targetType: 'listing',
        reporterId: 'duplicate-reporter',
        reportKey: `listing|${listingId}|duplicate-reporter`,
        reason: 'spam',
        createdAt: now - 1000,
      });
    });

    const asUniqueReporter2 = t.withIdentity({
      name: 'Reporter2',
      subject: 'reporter2-subject',
      email: 'reporter2@calpoly.edu',
    });
    await asUniqueReporter2.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'spam',
    });

    let listing = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });
    expect(listing?.isHidden).not.toBe(true);

    const asUniqueReporter3 = t.withIdentity({
      name: 'Reporter3',
      subject: 'reporter3-subject',
      email: 'reporter3@calpoly.edu',
    });
    await asUniqueReporter3.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'inappropriate',
    });

    listing = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });
    expect(listing?.isHidden).toBe(true);
  });

  it('profile auto-hidden after 3rd unique report', async () => {
    const t = convexTest(schema as any, modules);

    await createTestUser(t, 'reporter1@calpoly.edu');
    await createTestUser(t, 'reporter2@calpoly.edu');
    await createTestUser(t, 'reporter3@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter1-subject', 'reporter1@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter2-subject', 'reporter2@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter3-subject', 'reporter3@calpoly.edu');

    const profileId = await createTestProfile(t, 'profile-user-id');

    const asUser1 = t.withIdentity({
      name: 'Reporter1',
      subject: 'reporter1-subject',
      email: 'reporter1@calpoly.edu',
    });
    await asUser1.mutation(api.reports.createReport, {
      targetId: profileId,
      targetType: 'profile',
      reason: 'inappropriate',
    });

    const asUser2 = t.withIdentity({
      name: 'Reporter2',
      subject: 'reporter2-subject',
      email: 'reporter2@calpoly.edu',
    });
    await asUser2.mutation(api.reports.createReport, {
      targetId: profileId,
      targetType: 'profile',
      reason: 'inappropriate',
    });

    const asUser3 = t.withIdentity({
      name: 'Reporter3',
      subject: 'reporter3-subject',
      email: 'reporter3@calpoly.edu',
    });
    await asUser3.mutation(api.reports.createReport, {
      targetId: profileId,
      targetType: 'profile',
      reason: 'inappropriate',
    });

    // Check that profile is now hidden
    const profile = await t.run(async (ctx: any) => {
      return await ctx.db.get(profileId);
    });

    expect(profile?.isHidden).toBe(true);
    expect(profile?.hiddenReason).toBe('auto_moderation');
    expect(typeof profile?.hiddenAt).toBe('number');
  });

  it('hidden listing excluded from getListings query', async () => {
    const t = convexTest(schema as any, modules);

    // Create profile for seller
    await createTestProfile(t, 'seller-id');

    // Create a hidden listing
    const seller = t.withIdentity({
      name: 'Seller',
      subject: 'seller-id',
      email: 'seller@calpoly.edu',
    });
    const listingId = await seller.action(api.listings.createListing, {
      title: 'Test Listing',
      description: 'A test listing',
      price: 50,
      images: ['https://example.com/image.png'],
      condition: 'used',
      category: 'textbooks',
    });

    // Manually mark as hidden
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'auto_moderation',
      });
    });

    // Query listings
    const listings = await t.query(api.listings.getListings, {
      paginationOpts: { numItems: 100, cursor: null },
    });

    // Hidden listing should not be in the results
    expect(listings.page.find((l: any) => l._id === listingId)).toBeUndefined();
  });

  it('owner can view their own hidden listing via getListing', async () => {
    const t = convexTest(schema as any, modules);

    // Create profile for seller
    await createTestProfile(t, 'seller-id');

    // Create a listing
    const seller = t.withIdentity({
      name: 'Seller',
      subject: 'seller-id',
      email: 'seller@calpoly.edu',
    });
    const listingId = await seller.action(api.listings.createListing, {
      title: 'Test Listing',
      description: 'A test listing',
      price: 50,
      images: ['https://example.com/image.png'],
      condition: 'used',
      category: 'textbooks',
    });

    // Mark as hidden
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'auto_moderation',
      });
    });

    // Owner should still be able to see it
    const listing = await seller.query(api.listings.getListing, { id: listingId });
    expect(listing).not.toBeNull();
    expect(listing?.isHidden).toBe(true);
  });

  it('non-owner cannot view hidden listing via getListing', async () => {
    const t = convexTest(schema as any, modules);

    // Create profile for seller
    await createTestProfile(t, 'seller-id');

    // Create a listing
    const seller = t.withIdentity({
      name: 'Seller',
      subject: 'seller-id',
      email: 'seller@calpoly.edu',
    });
    const listingId = await seller.action(api.listings.createListing, {
      title: 'Test Listing',
      description: 'A test listing',
      price: 50,
      images: ['https://example.com/image.png'],
      condition: 'used',
      category: 'textbooks',
    });

    // Mark as hidden
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'auto_moderation',
      });
    });

    // Different user should get null
    const otherUser = t.withIdentity({
      name: 'Other',
      subject: 'other-id',
      email: 'other@calpoly.edu',
    });
    const listing = await otherUser.query(api.listings.getListing, { id: listingId });
    expect(listing).toBeNull();
  });

  it("getMyHiddenListings returns only user's hidden listings", async () => {
    const t = convexTest(schema as any, modules);

    // Create profile for seller
    await createTestProfile(t, 'seller-id');

    const seller = t.withIdentity({
      name: 'Seller',
      subject: 'seller-id',
      email: 'seller@calpoly.edu',
    });

    // Create 2 listings
    const listingId1 = await seller.action(api.listings.createListing, {
      title: 'Test Listing 1',
      description: 'First listing',
      price: 50,
      images: ['https://example.com/image.png'],
      condition: 'used',
      category: 'textbooks',
    });

    await seller.action(api.listings.createListing, {
      title: 'Test Listing 2',
      description: 'Second listing',
      price: 60,
      images: ['https://example.com/image.png'],
      condition: 'new',
      category: 'electronics',
    });

    // Hide first listing
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId1, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'auto_moderation',
      });
    });

    // Query hidden listings
    const hiddenListings = await seller.query(api.listings.getMyHiddenListings, {});

    expect(hiddenListings.length).toBe(1);
    expect(hiddenListings[0]._id).toBe(listingId1);
    expect(hiddenListings[0].isHidden).toBe(true);
  });

  it('hidden content excluded from searchAndFilterListings', async () => {
    const t = convexTest(schema as any, modules);

    // Create profile for seller
    await createTestProfile(t, 'seller-id');

    const seller = t.withIdentity({
      name: 'Seller',
      subject: 'seller-id',
      email: 'seller@calpoly.edu',
    });

    // Create a listing
    const listingId = await seller.action(api.listings.createListing, {
      title: 'Test Textbook',
      description: 'A test textbook',
      price: 50,
      images: ['https://example.com/image.png'],
      condition: 'used',
      category: 'textbooks',
    });

    // Hide it
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'auto_moderation',
      });
    });

    // Search for it
    const results = await t.query(api.listings.searchAndFilterListings, {
      filters: { category: 'textbooks' },
      paginationOpts: { numItems: 100, cursor: null },
    });

    // Should not be in results
    expect(results.page.find((l: any) => l._id === listingId)).toBeUndefined();
  });
  it('auto-hide does NOT overwrite existing hidden context', async () => {
    const t = convexTest(schema as any, modules);

    // Create a listing
    const listingId = await createTestListing(t, 'seller-id');

    // Manually hide it (simulating admin action)
    const originalHiddenAt = Date.now() - 10000;
    await t.run(async (ctx: any) => {
      await ctx.db.patch(listingId, {
        isHidden: true,
        hiddenAt: originalHiddenAt,
        hiddenReason: 'manual_admin_action',
      });
    });

    // Create 3 reports (triggering threshold)
    await createTestUser(t, 'reporter1@calpoly.edu');
    await createTestUser(t, 'reporter2@calpoly.edu');
    await createTestUser(t, 'reporter3@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter1-subject', 'reporter1@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter2-subject', 'reporter2@calpoly.edu');
    await createQualifiedReporterProfile(t, 'reporter3-subject', 'reporter3@calpoly.edu');

    const asUser1 = t.withIdentity({
      name: 'Reporter1',
      subject: 'reporter1-subject',
      email: 'reporter1@calpoly.edu',
    });
    await asUser1.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    const asUser2 = t.withIdentity({
      name: 'Reporter2',
      subject: 'reporter2-subject',
      email: 'reporter2@calpoly.edu',
    });
    await asUser2.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    const asUser3 = t.withIdentity({
      name: 'Reporter3',
      subject: 'reporter3-subject',
      email: 'reporter3@calpoly.edu',
    });
    await asUser3.mutation(api.reports.createReport, {
      targetId: listingId,
      targetType: 'listing',
      reason: 'scam',
    });

    // Verify listing is still hidden but metadata is UNCHANGED
    const listing = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });

    expect(listing?.isHidden).toBe(true);
    expect(listing?.hiddenReason).toBe('manual_admin_action'); // Should NOT be 'auto_moderation'
    expect(listing?.hiddenAt).toBe(originalHiddenAt); // Should prevent update
  });
});

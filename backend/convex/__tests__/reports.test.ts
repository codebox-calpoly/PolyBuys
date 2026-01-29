// backend/convex/__tests__/reports.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
import * as reportsModule from '../reports';
import * as listingsModule from '../listings';
import * as profilesModule from '../profiles';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';

// Import all Convex function modules so convex-test can run them
const modules = {
  '../reports.ts': () => Promise.resolve(reportsModule),
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../profiles.ts': () => Promise.resolve(profilesModule),
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
        emailVerified: true,
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
        sellerEmail: 'seller@calpoly.edu',
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

  it('createReport succeeds with valid listing report', async () => {
    const t = convexTest(schema as any, modules);

    // Create user and listing
    const userId = await createTestUser(t, 'reporter@calpoly.edu');
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
      reporterId: userId,
      reason: 'scam',
      notes: 'This looks like a scam',
    });
    expect(typeof report?.createdAt).toBe('number');
  });

  it('createReport succeeds with valid profile report', async () => {
    const t = convexTest(schema as any, modules);

    // Create users and profile
    const reporterId = await createTestUser(t, 'reporter@calpoly.edu');
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
      reporterId,
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
});

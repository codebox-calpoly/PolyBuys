/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { createTestListing, createConvexTest } from './testUtils';

const aliceIdentity = { name: 'Alice', subject: 'alice-id', email: 'alice@calpoly.edu' };
const bobIdentity = { name: 'Bob', subject: 'bob-id', email: 'bob@calpoly.edu' };

async function setupTestWithProfiles() {
  const t = createConvexTest();

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
      userId: bobIdentity.subject,
      name: bobIdentity.name,
      email: bobIdentity.email,
      major: 'Computer Science',
      year: 2025,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });
  });

  return t;
}

describe('Saved listings', () => {
  it('toggleSavedListing requires auth', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);

    await expect(t.mutation(api.savedListings.toggleSavedListing, { listingId })).rejects.toThrow();
  });

  it('toggleSavedListing saves when not saved', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    const result = await asAlice.mutation(api.savedListings.toggleSavedListing, {
      listingId,
    });

    expect(result.saved).toBe(true);

    const isSaved = await asAlice.query(api.savedListings.isListingSaved, {
      listingId,
    });
    expect(isSaved).toBe(true);
  });

  it('toggleSavedListing unsaves when already saved', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.toggleSavedListing, { listingId });
    const result = await asAlice.mutation(api.savedListings.toggleSavedListing, {
      listingId,
    });

    expect(result.saved).toBe(false);

    const isSaved = await asAlice.query(api.savedListings.isListingSaved, {
      listingId,
    });
    expect(isSaved).toBe(false);
  });

  it('saveListing is idempotent', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.saveListing, { listingId });
    await asAlice.mutation(api.savedListings.saveListing, { listingId });

    const saved = await t.run(async (ctx: any) => {
      return await ctx.db
        .query('savedListings')
        .withIndex('by_user_listing', (q: any) =>
          q.eq('userId', aliceIdentity.subject).eq('listingId', listingId)
        )
        .collect();
    });

    expect(saved.length).toBe(1);
  });

  it('getSavedStateForListings returns correct map', async () => {
    const t = await setupTestWithProfiles();
    const listing1 = await createTestListing(t, 'bob-id' as Id<'users'>);
    const listing2 = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.saveListing, { listingId: listing1 });

    const state = await asAlice.query(api.savedListings.getSavedStateForListings, {
      listingIds: [listing1, listing2],
    });

    expect(state[listing1]).toBe(true);
    expect(state[listing2]).toBe(false);
  });

  it('getMySavedListings returns saved items with listing and isUnavailable', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.saveListing, { listingId });

    const result = await asAlice.query(api.savedListings.getMySavedListings, {
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page.length).toBe(1);
    expect(result.page[0].listingId).toBe(listingId);
    expect(result.page[0].listing).not.toBeNull();
    expect(result.page[0].listing?.title).toBe('Test Listing');
    expect(result.page[0].isUnavailable).toBe(false);
  });

  it('getMySavedListings marks inactive listing as unavailable', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>, {
      status: 'inactive',
    });
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.saveListing, { listingId });

    const result = await asAlice.query(api.savedListings.getMySavedListings, {
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page.length).toBe(1);
    expect(result.page[0].isUnavailable).toBe(true);
  });

  it('getMySavedListings marks sold listing as unavailable', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>, {
      status: 'sold',
    });
    const asAlice = t.withIdentity(aliceIdentity);

    await asAlice.mutation(api.savedListings.saveListing, { listingId });

    const result = await asAlice.query(api.savedListings.getMySavedListings, {
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(result.page.length).toBe(1);
    expect(result.page[0].isUnavailable).toBe(true);
    expect(result.page[0].listing?.status).toBe('sold');
  });

  it('toggleSavedListing rejects non-existent listing', async () => {
    const t = await setupTestWithProfiles();
    const listingId = await createTestListing(t, 'bob-id' as Id<'users'>);
    const asAlice = t.withIdentity(aliceIdentity);

    await t.run(async (ctx: any) => {
      const listing = await ctx.db.get(listingId);
      if (listing) await ctx.db.delete(listingId);
    });

    await expect(
      asAlice.mutation(api.savedListings.toggleSavedListing, { listingId })
    ).rejects.toThrow('Listing not found');
  });
});

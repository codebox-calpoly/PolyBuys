// backend/convex/__tests__/listings.test.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
import * as listingsModule from '../listings';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';

// Import all Convex function modules so convex-test can run them.
// In Jest, we use direct imports instead of import.meta.glob
// Wrap modules in functions to match the expected format
const modules = {
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

describe('Listings mutations', () => {
  // Helper: base valid args for createListing
  const baseArgs = {
    title: 'Great textbook for CSC 202',
    description: 'Gently used, highlights in a few chapters.',
    price: 50,
    sellerEmail: 'test@example.com',
    category: 'textbooks' as const,
    images: ['https://example.com/book1.png'],
    condition: 'used' as const,
  };

  it('createListing succeeds with valid data', async () => {
    const t = convexTest(schema as any, modules);

    // Simulate an authenticated user
    const asUser = t.withIdentity({ name: 'Alice', subject: 'alice-id' });

    const listingId = await asUser.mutation(api.listings.createListing, baseArgs);

    // Look up the listing directly in the mock DB
    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toMatchObject({
      title: baseArgs.title,
      description: baseArgs.description,
      price: baseArgs.price,
      sellerEmail: baseArgs.sellerEmail,
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
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        title: 'Hey', // 3 chars, too short
      });
    }).rejects.toThrowError('Title must be 5-100 characters');
  });

  it('createListing fails when images array is empty', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        images: [],
      });
    }).rejects.toThrowError('Must have 1-8 images');
  });

  it('createListing fails when images array is too long', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    const tooManyImages = Array.from({ length: 9 }, (_, i) => `https://example.com/img${i}.png`);

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        images: tooManyImages,
      });
    }).rejects.toThrowError('Must have 1-8 images');
  });

  it('updateListing allows the owner to update fields', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    // Create listing as owner
    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    // Update the title and price
    await asOwner.mutation(api.listings.updateListing, {
      id: listingId,
      title: 'Updated listing title',
      price: 75,
    });

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(updated).toMatchObject({
      title: 'Updated listing title',
      price: 75,
      sellerId: 'owner-id',
    });
  });

  it('updateListing rejects updates from non-owner', async () => {
    const t = convexTest(schema as any, modules);

    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });
    const asOtherUser = t.withIdentity({ name: 'Other', subject: 'other-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOtherUser.mutation(api.listings.updateListing, {
        id: listingId,
        title: 'Hacked title',
      });
    }).rejects.toThrowError('You are not the owner of this listing');
  });

  it('deleteListing performs a soft delete by setting status to deleted', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.deleteListing, { id: listingId });

    const deleted = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(deleted?.status).toBe('deleted');
  });

  it('updateListing cannot update a deleted listing', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    await asOwner.mutation(api.listings.deleteListing, { id: listingId });

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListing, {
        id: listingId,
        title: 'New title after delete',
      });
    }).rejects.toThrowError('Cannot update a deleted listing');
  });
});

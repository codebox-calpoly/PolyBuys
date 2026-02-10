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

// Helper: base valid args for createListing
const baseArgs = {
  title: 'Great textbook for CSC 202',
  description: 'Gently used, highlights in a few chapters.',
  price: 50,
  sellerEmail: 'test@example.com',
  category: 'textbooks' as const,
  images: ['https://example.com/book1.png'],
  condition: 'used' as const,
  tags: ['csc202'],
};

describe('Listings mutations', () => {
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
      tags: baseArgs.tags,
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

  it('createListing normalizes tags to be trimmed and in lowercase', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    const unnormalized = '   fOUrTH EditION ';

    const listingId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      tags: [unnormalized],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition']);
  });

  it('createListing removes duplicate tags', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    const listingId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      tags: ['fourth edition', 'FOURTH EDITION', '   fourth edition    ', 'csc101'],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition', 'csc101']);
  });

  it('createListing fails when tags array is too long', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        tags: ['csc101', 'gently used', 'fourth edition', 'answers', 'textbook', 'hardcover'],
      });
    }).rejects.toThrowError('Maximum 5 tags allowed');
  });

  it('createListing fails when tag is empty', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        tags: [' '],
      });
    }).rejects.toThrowError('Empty tags are not allowed');
  });

  it('createListing fails when tag is >20 characters long', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    await expect(async () => {
      await asUser.mutation(api.listings.createListing, {
        ...baseArgs,
        tags: ['supercalifragilisticexpialidocious'],
      });
    }).rejects.toThrowError('Tags must be 20 characters or less');
  });

  it('createListing succeeds with no tags', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice' });

    const listingId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      tags: [],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual([]);
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

  it('updateListing, normalizes tags to be trimmed and in lowercase', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const unnormalized = '   fOUrTH EditION ';

    const listingId = await asOwner.mutation(api.listings.createListing, {
      ...baseArgs,
      tags: [unnormalized],
    });

    await asOwner.mutation(api.listings.updateListing, {
      id: listingId,
      tags: ['   fOurTH EdiTIOn  '],
    });

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });
    expect(updated).toBeDefined();
    expect(updated?.tags).toEqual(['fourth edition']);
  });

  it('updateListing removes duplicate tags', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);
    await asOwner.mutation(api.listings.updateListing, {
      id: listingId,
      tags: ['fourth edition', 'FOURTH EDITION', '   fourth edition    ', 'csc101'],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual(['fourth edition', 'csc101']);
  });

  it('updateListing fails when tags array is too long', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListing, {
        id: listingId,
        tags: ['csc101', 'gently used', 'fourth edition', 'answers', 'textbook', 'hardcover'],
      });
    }).rejects.toThrowError('Maximum 5 tags allowed');
  });

  it('updateListing fails when tag is empty', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);

    await expect(async () => {
      await asOwner.mutation(api.listings.updateListing, {
        id: listingId,
        tags: [' '],
      });
    }).rejects.toThrowError('Empty tags are not allowed');
  });

  it('updateListing fails when tag is >20 characters long', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    await expect(async () => {
      await asOwner.mutation(api.listings.createListing, {
        ...baseArgs,
        tags: ['supercalifragilisticexpialidocious'],
      });
    }).rejects.toThrowError('Tags must be 20 characters or less');
  });

  it('updateListing succeeds with no tags', async () => {
    const t = convexTest(schema as any, modules);
    const asOwner = t.withIdentity({ name: 'Owner', subject: 'owner-id' });

    const listingId = await asOwner.mutation(api.listings.createListing, baseArgs);
    await asOwner.mutation(api.listings.updateListing, {
      id: listingId,
      tags: [],
    });

    const listing = await t.run(async (ctx) => {
      return await ctx.db.get(listingId);
    });

    expect(listing).toBeDefined();
    expect(listing?.tags).toEqual([]);
  });
});

describe('Listings queries', () => {
  it.skip('getListings filters by tags and combines with category/price', async () => {
    // Skipped: convex-test does not currently model array index element matching for tags.
    // This test is intended for integration against a real Convex backend.
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({ name: 'Alice', subject: 'alice-id' });

    const deskId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      title: 'Wood Desk',
      price: 80,
      category: 'furniture',
      tags: ['desk', 'wood'],
    });

    const chairId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      title: 'Wood Chair',
      price: 120,
      category: 'furniture',
      tags: ['chair', 'wood'],
    });

    const laptopId = await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      title: 'Gaming Laptop',
      price: 900,
      category: 'electronics',
      tags: ['laptop', 'gaming'],
    });

    await asUser.mutation(api.listings.createListing, {
      ...baseArgs,
      title: 'CSC101 Book',
      price: 50,
      category: 'textbooks',
      tags: ['csc101'],
    });

    const ids = (listings: Array<{ _id: string }>) => listings.map((listing) => listing._id).sort();

    const singleTag = await t.query(api.listings.getListings, { tags: ['desk'] });
    expect(ids(singleTag)).toEqual([deskId]);

    const multipleTags = await t.query(api.listings.getListings, { tags: ['desk', 'gaming'] });
    expect(ids(multipleTags)).toEqual([deskId, laptopId].sort());

    const tagAndCategory = await t.query(api.listings.getListings, {
      tags: ['wood'],
      category: 'furniture',
    });
    expect(ids(tagAndCategory)).toEqual([deskId, chairId].sort());

    const tagAndPrice = await t.query(api.listings.getListings, {
      tags: ['wood'],
      maxPrice: 100,
    });
    expect(ids(tagAndPrice)).toEqual([deskId]);

    const tagCategoryPrice = await t.query(api.listings.getListings, {
      tags: ['wood'],
      category: 'furniture',
      maxPrice: 100,
    });
    expect(ids(tagCategoryPrice)).toEqual([deskId]);

    const caseInsensitive = await t.query(api.listings.getListings, { tags: ['DeSk'] });
    expect(ids(caseInsensitive)).toEqual([deskId]);

    const noMatches = await t.query(api.listings.getListings, { tags: ['nonexistent'] });
    expect(noMatches).toEqual([]);
  });
});

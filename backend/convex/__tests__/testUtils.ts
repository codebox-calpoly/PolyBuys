/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import type { Id } from '../_generated/dataModel';

// Import all Convex function modules
import * as listingsModule from '../listings';
import * as profilesModule from '../profiles';
import * as savedListingsModule from '../savedListings';
import * as usersModule from '../users';
import * as messagesModule from '../messages';
import * as blocksModule from '../blocks';
import * as reportsModule from '../reports';
import * as moderationModule from '../moderation';
import * as pushNotificationsModule from '../pushNotifications';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';

// Module configuration for convex-test
export const modules = {
  '../listings.ts': () => Promise.resolve(listingsModule),
  '../profiles.ts': () => Promise.resolve(profilesModule),
  '../savedListings.ts': () => Promise.resolve(savedListingsModule),
  '../users.ts': () => Promise.resolve(usersModule),
  '../messages.ts': () => Promise.resolve(messagesModule),
  '../blocks.ts': () => Promise.resolve(blocksModule),
  '../reports.ts': () => Promise.resolve(reportsModule),
  '../moderation.ts': () => Promise.resolve(moderationModule),
  '../pushNotifications.ts': () => Promise.resolve(pushNotificationsModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

export interface TestUser {
  id: Id<'users'>;
  email: string;
  name: string;
  identity: {
    name: string;
    subject: string;
    email: string;
  };
}

/**
 * Creates a test user in the database and returns user info with identity
 */
export async function createTestUser(t: any, email: string, name: string): Promise<TestUser> {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert('users', {
      email: email.toLowerCase(),
      name,
      emailVerified: true,
      createdAt: Date.now(),
    });
  });

  return {
    id: userId,
    email: email.toLowerCase(),
    name,
    identity: {
      name,
      subject: userId,
      email,
    },
  };
}

/**
 * Creates a test profile in the database
 */
export async function createTestProfile(
  t: any,
  userId: string,
  overrides?: Partial<{
    name: string;
    email: string;
    bio: string;
    major: string;
    year: number;
  }>
): Promise<Id<'profiles'>> {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert('profiles', {
      userId,
      name: overrides?.name ?? 'Test User',
      email: overrides?.email ?? 'test@calpoly.edu',
      bio: overrides?.bio,
      major: overrides?.major ?? 'Computer Science',
      year: overrides?.year ?? 2025,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });
  });
}

/**
 * Creates a test listing in the database
 */
export async function createTestListing(
  t: any,
  sellerId: Id<'users'>,
  overrides?: Partial<{
    title: string;
    description: string;
    price: number;
    category: 'textbooks' | 'electronics' | 'furniture' | 'tickets' | 'other';
    images: string[];
    condition: 'new' | 'used' | 'refurbished';
    tags: string[];
    status: 'active' | 'sold' | 'inactive' | 'deleted';
  }>
): Promise<Id<'listings'>> {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert('listings', {
      sellerId,
      title: overrides?.title ?? 'Test Listing',
      description: overrides?.description ?? 'Test description',
      price: overrides?.price ?? 100,
      category: overrides?.category ?? 'textbooks',
      images: overrides?.images ?? ['https://example.com/image.jpg'],
      condition: overrides?.condition ?? 'new',
      tags: overrides?.tags,
      status: overrides?.status ?? 'active',
      createdAt: Date.now(),
      postedOn: Date.now(),
    });
  });
}

/**
 * Creates a test conversation between buyer and seller (no messages).
 * For listUserConversations tests, use createTestConversation.
 */
export async function createTestConversationEmpty(
  t: any,
  listingId: Id<'listings'>,
  buyerId: Id<'users'>,
  sellerId: Id<'users'>
): Promise<Id<'conversations'>> {
  return await t.run(async (ctx: any) => {
    const now = Date.now();
    return await ctx.db.insert('conversations', {
      listingId,
      buyerId,
      sellerId,
      participantIds: [buyerId, sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });
  });
}

/**
 * Creates a test conversation between buyer and seller with one message.
 * listUserConversations only returns conversations with at least one message.
 */
export async function createTestConversation(
  t: any,
  listingId: Id<'listings'>,
  buyerId: Id<'users'>,
  sellerId: Id<'users'>
): Promise<Id<'conversations'>> {
  return await t.run(async (ctx: any) => {
    const now = Date.now();
    const conversationId = await ctx.db.insert('conversations', {
      listingId,
      buyerId,
      sellerId,
      participantIds: [buyerId, sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      listingId,
      senderId: buyerId,
      recipientId: sellerId,
      type: 'text',
      body: 'Test message',
      createdAt: now,
      readAt: 0,
    });
    await ctx.db.patch(conversationId, { lastMessageId: messageId });
    return conversationId;
  });
}

/**
 * Creates a Convex test instance with schema and modules
 */
export function createConvexTest() {
  return convexTest(schema as any, modules);
}

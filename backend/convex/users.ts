import { getAuthUserId } from '@convex-dev/auth/server';
import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { components } from './_generated/api';
import { query, mutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v, ConvexError } from 'convex/values';

const pushNotifications = new PushNotifications<string>(components.pushNotifications);

function toPublicUser(user: Doc<'users'> | null) {
  if (!user) {
    return null;
  }

  const email = user.email?.toLowerCase().trim();
  if (!email) {
    return null;
  }

  return {
    _id: user._id,
    _creationTime: user._creationTime,
    email,
    name: user.name ?? null,
    emailVerified: user.emailVerified ?? false,
    createdAt: user.createdAt ?? user._creationTime,
  };
}

/**
 * Get the current authenticated user's profile from our users table
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const authUser = await ctx.db.get(userId);
    return toPublicUser(authUser);
  },
});

/**
 * Update user profile (name, etc.)
 */
export const updateUserProfile = mutation({
  args: {
    name: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('Not authenticated');
    }

    const authUser = await ctx.db.get(userId);
    const normalizedUser = toPublicUser(authUser);
    if (!authUser || !normalizedUser) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(userId, {
      email: normalizedUser.email,
      name: args.name ?? undefined,
      createdAt: authUser.createdAt ?? authUser._creationTime,
      emailVerified: authUser.emailVerified ?? false,
    });

    const updatedUser = await ctx.db.get(userId);
    const updatedNormalizedUser = toPublicUser(updatedUser);
    if (!updatedNormalizedUser) {
      throw new ConvexError('User not found');
    }

    return updatedNormalizedUser;
  },
});

/**
 * Get or create user profile after authentication
 * Called when user successfully authenticates via OTP
 */
export const getOrCreateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('Not authenticated');
    }

    const authUser = await ctx.db.get(userId);
    const normalizedUser = toPublicUser(authUser);
    if (!authUser || !normalizedUser) {
      throw new ConvexError('Auth user not found');
    }

    await ctx.db.patch(userId, {
      email: normalizedUser.email,
      createdAt: authUser.createdAt ?? authUser._creationTime,
      emailVerified: authUser.emailVerified ?? false,
      name: authUser.name ?? undefined,
    });

    const updatedUser = await ctx.db.get(userId);
    const updatedNormalizedUser = toPublicUser(updatedUser);
    if (!updatedNormalizedUser) {
      throw new ConvexError('Auth user not found');
    }

    return updatedNormalizedUser;
  },
});

/**
 * Get message notification preference. Defaults to true when unset.
 */
export const getMessageNotificationsEnabled = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return user.messageNotificationsEnabled !== false;
  },
});

/**
 * Update message notification preference.
 */
export const updateMessageNotificationsEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('Not authenticated');
    }

    await ctx.db.patch(userId, {
      messageNotificationsEnabled: args.enabled,
    });

    return { ok: true };
  },
});

/**
 * Permanently delete the current user's account and all associated data.
 * Removes user, profile, listings, messages, conversations, blocks, reports, etc.
 * Convex mutations are atomic: all operations commit together or roll back on failure.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('Not authenticated');
    }

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    const listings = await ctx.db
      .query('listings')
      .withIndex('by_seller_createdAt', (q) => q.eq('sellerId', userId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Reports: by this user, or about this user's profile/listings
    const reportsByUser = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', userId))
      .collect();
    for (const r of reportsByUser) await ctx.db.delete(r._id);

    if (profile) {
      const reportsAboutProfile = await ctx.db
        .query('reports')
        .withIndex('by_target', (q) => q.eq('targetId', profile._id).eq('targetType', 'profile'))
        .collect();
      for (const r of reportsAboutProfile) await ctx.db.delete(r._id);
    }

    for (const listing of listings) {
      const reportsAboutListing = await ctx.db
        .query('reports')
        .withIndex('by_target', (q) => q.eq('targetId', listing._id).eq('targetType', 'listing'))
        .collect();
      for (const r of reportsAboutListing) await ctx.db.delete(r._id);
    }

    // Moderation results
    const moderationRows = await ctx.db
      .query('moderationResults')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const m of moderationRows) await ctx.db.delete(m._id);

    // User blocks (blocker or blocked)
    const blocksAsBlocker = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', userId))
      .collect();
    for (const b of blocksAsBlocker) await ctx.db.delete(b._id);
    const blocksAsBlocked = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocked_blocker', (q) => q.eq('blockedId', userId))
      .collect();
    for (const b of blocksAsBlocked) await ctx.db.delete(b._id);

    // Conversations where user is buyer or seller
    const convosAsBuyer = await ctx.db
      .query('conversations')
      .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
      .collect();
    const convosAsSeller = await ctx.db
      .query('conversations')
      .withIndex('by_seller', (q) => q.eq('sellerId', userId))
      .collect();
    const allConvos = [...convosAsBuyer, ...convosAsSeller];
    const seen = new Set<string>();
    const uniqueConvos = allConvos.filter((c) => {
      const id = c._id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    for (const convo of uniqueConvos) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', convo._id))
        .collect();
      for (const msg of messages) await ctx.db.delete(msg._id);
      await ctx.db.delete(convo._id);
    }

    // Saved listings: by this user, and by others for our listings
    const savedByUser = await ctx.db
      .query('savedListings')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .collect();
    for (const s of savedByUser) await ctx.db.delete(s._id);

    for (const lid of listingIds) {
      const savedForListing = await ctx.db
        .query('savedListings')
        .withIndex('by_listing', (q) => q.eq('listingId', lid))
        .collect();
      for (const s of savedForListing) await ctx.db.delete(s._id);
    }

    // Listings: delete storage images then listing
    for (const listing of listings) {
      for (const img of listing.images) {
        try {
          await ctx.storage.delete(img as Id<'_storage'>);
        } catch {
          // Ignore invalid storage IDs (e.g. external URLs)
        }
      }
      await ctx.db.delete(listing._id);
    }

    // Profile: delete picture storage then profile
    if (profile) {
      if (profile.picture) {
        try {
          await ctx.storage.delete(profile.picture);
        } catch {
          // Ignore
        }
      }
      await ctx.db.delete(profile._id);
    }

    // Push tokens
    await pushNotifications.removeToken(ctx, { userId });

    // Auth tables (Convex Auth)
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect();

    for (const session of sessions) {
      const verifiers = await ctx.db
        .query('authVerifiers')
        .filter((q) => q.eq(q.field('sessionId'), session._id))
        .collect();
      for (const v of verifiers) await ctx.db.delete(v._id);

      const refreshTokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect();
      for (const rt of refreshTokens) await ctx.db.delete(rt._id);
    }

    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect();

    for (const account of accounts) {
      const codes = await ctx.db
        .query('authVerificationCodes')
        .withIndex('accountId', (q) => q.eq('accountId', account._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(account._id);
    }

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(userId);

    return { ok: true };
  },
});

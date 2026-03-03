import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { v, ConvexError } from 'convex/values';

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

    const newName = args.name ?? undefined;
    // Only patch when the name actually changed — avoids spurious reactive
    // invalidations for all useQuery(getCurrentUser) subscribers.
    if (authUser.name !== newName) {
      await ctx.db.patch(userId, { name: newName });
    }

    // Build return from known values; no second DB round-trip needed.
    return { ...normalizedUser, name: newName ?? null };
  },
});

/**
 * Get or create user profile after authentication.
 *
 * @deprecated No longer called by the frontend — Convex Auth handles user
 * creation automatically. Retained for backward compatibility and existing
 * test coverage. When removing, also drop the corresponding suite in
 * users.test.ts.
 *
 * Only patches fields that have drifted from the current record to avoid
 * spurious reactive invalidations for getCurrentUser subscribers.
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

    const wantEmail = normalizedUser.email;
    const wantCreatedAt = authUser.createdAt ?? authUser._creationTime;
    const wantEmailVerified = authUser.emailVerified ?? false;
    if (
      authUser.email !== wantEmail ||
      authUser.createdAt !== wantCreatedAt ||
      (authUser.emailVerified ?? false) !== wantEmailVerified
    ) {
      await ctx.db.patch(userId, {
        email: wantEmail,
        createdAt: wantCreatedAt,
        emailVerified: wantEmailVerified,
        name: authUser.name ?? undefined,
      });
    }

    return normalizedUser;
  },
});

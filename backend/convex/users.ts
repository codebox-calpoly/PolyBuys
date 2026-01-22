import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';

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

    // Get the auth user record
    const authUser = await ctx.db.get(userId);
    if (!authUser) {
      return null;
    }

    // Find user profile by email
    const userProfile = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email!))
      .first();

    return userProfile;
  },
});

/**
 * Check if an email already exists
 */
export const checkEmailExists = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase().trim()))
      .first();

    return existingUser !== null;
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
    if (!authUser || !authUser.email) {
      throw new ConvexError('User not found');
    }

    const userProfile = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', authUser.email!))
      .first();

    if (!userProfile) {
      throw new ConvexError('User profile not found');
    }

    await ctx.db.patch(userProfile._id, {
      name: args.name,
    });

    return await ctx.db.get(userProfile._id);
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
    if (!authUser || !authUser.email) {
      throw new ConvexError('Auth user not found');
    }

    const email = authUser.email.toLowerCase().trim();

    // Check if user profile already exists
    const existingProfile = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (existingProfile) {
      return existingProfile;
    }

    // Create new user profile
    const profileId = await ctx.db.insert('users', {
      email,
      name: authUser.name || null,
      createdAt: Date.now(),
    });

    return await ctx.db.get(profileId);
  },
});

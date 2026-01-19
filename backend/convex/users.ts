import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { auth } from './auth';
import { ConvexError } from 'convex/values';

/**
 * Get the current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await auth.getUserIdentity(ctx);
    if (!identity) {
      return null;
    }

    // Find user by email (which matches the identity email)
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email))
      .first();

    return user;
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
    const identity = await auth.getUserIdentity(ctx);
    if (!identity) {
      throw new ConvexError('Not authenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email))
      .first();

    if (!user) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(user._id, {
      name: args.name,
    });

    return await ctx.db.get(user._id);
  },
});

/**
 * Create user profile after email verification
 * This is typically called automatically by the auth system,
 * but we provide it as a utility function
 */
export const createUserProfile = mutation({
  args: {
    email: v.string(),
    name: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase().trim()))
      .first();

    if (existingUser) {
      throw new ConvexError('User with this email already exists');
    }

    const userId = await ctx.db.insert('users', {
      email: args.email.toLowerCase().trim(),
      emailVerified: false,
      name: args.name || null,
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

/**
 * Mark user email as verified (requires valid token)
 */
export const markEmailVerified = mutation({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const token = args.token.trim();

    // Find the verification token
    const verificationToken = await ctx.db
      .query('verificationTokens')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!verificationToken) {
      throw new ConvexError('Verification code not found. Please request a new code.');
    }

    // Check if token matches
    if (verificationToken.token !== token) {
      throw new ConvexError('Invalid verification code. Please try again.');
    }

    // Check if token is expired (24 hours)
    if (Date.now() > verificationToken.expiresAt) {
      // Delete expired token
      await ctx.db.delete(verificationToken._id);
      throw new ConvexError('Verification code has expired. Please request a new code.');
    }

    // Find the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!user) {
      throw new ConvexError('User not found');
    }

    // Mark email as verified
    await ctx.db.patch(user._id, {
      emailVerified: true,
    });

    // Delete the used token
    await ctx.db.delete(verificationToken._id);

    return await ctx.db.get(user._id);
  },
});

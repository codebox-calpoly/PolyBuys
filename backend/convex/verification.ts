import { v } from 'convex/values';
import { mutation } from './_generated/server';

/**
 * Store a verification token for an email
 * Replaces any existing token for that email
 */
export const storeVerificationToken = mutation({
  args: {
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // Delete any existing tokens for this email
    const existingTokens = await ctx.db
      .query('verificationTokens')
      .withIndex('by_email', (q) => q.eq('email', email))
      .collect();

    for (const token of existingTokens) {
      await ctx.db.delete(token._id);
    }

    // Store new token
    await ctx.db.insert('verificationTokens', {
      email,
      token: args.token,
      expiresAt: args.expiresAt,
    });
  },
});

/**
 * Delete verification token for an email
 */
export const deleteVerificationToken = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    const existingTokens = await ctx.db
      .query('verificationTokens')
      .withIndex('by_email', (q) => q.eq('email', email))
      .collect();

    for (const token of existingTokens) {
      await ctx.db.delete(token._id);
    }
  },
});

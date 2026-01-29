import { v, ConvexError } from 'convex/values';
import { mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';

const MAX_NOTES_LENGTH = 500;
const MAX_REPORTS_PER_DAY = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Create a new report for a listing or profile
 * Includes validation, duplicate prevention, and rate limiting
 */
export const createReport = mutation({
  args: {
    targetId: v.string(),
    targetType: v.union(v.literal('listing'), v.literal('profile')),
    reason: v.union(v.literal('scam'), v.literal('inappropriate'), v.literal('spam')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Validate user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to report content');
    }

    // 2. Get the user from the users table
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!user) {
      throw new ConvexError('User not found');
    }

    // 3. Validate notes length if provided
    if (args.notes && args.notes.length > MAX_NOTES_LENGTH) {
      throw new ConvexError(`Notes must be ${MAX_NOTES_LENGTH} characters or less`);
    }

    // 4. Validate target exists
    if (args.targetType === 'listing') {
      const listing = await ctx.db.get(args.targetId as Id<'listings'>);
      if (!listing) {
        throw new ConvexError('Listing not found');
      }
    } else if (args.targetType === 'profile') {
      const profile = await ctx.db.get(args.targetId as Id<'profiles'>);
      if (!profile) {
        throw new ConvexError('Profile not found');
      }
    }

    // 5. Check for duplicate report (same user + same target)
    const existingReport = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.targetId).eq('targetType', args.targetType)
      )
      .filter((q) => q.eq(q.field('reporterId'), user._id))
      .first();

    if (existingReport) {
      throw new ConvexError('You have already reported this content');
    }

    // 6. Check rate limiting (max 10 reports per day)
    const oneDayAgo = Date.now() - ONE_DAY_MS;
    const recentReports = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', user._id))
      .filter((q) => q.gt(q.field('createdAt'), oneDayAgo))
      .collect();

    if (recentReports.length >= MAX_REPORTS_PER_DAY) {
      throw new ConvexError('Report limit reached. Please try again later.');
    }

    // 7. Create the report
    const reportId = await ctx.db.insert('reports', {
      targetId: args.targetId,
      targetType: args.targetType,
      reporterId: user._id,
      reason: args.reason,
      notes: args.notes,
      createdAt: Date.now(),
    });

    return reportId;
  },
});

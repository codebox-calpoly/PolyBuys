import { v, ConvexError } from 'convex/values';
import { mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAuthUserId } from './lib/authIdentity';

const MAX_NOTES_LENGTH = 500;
const MAX_REPORTS_PER_DAY = 10;
const REPORT_THRESHOLD = 3; // Number of unique reporters before auto-hide
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
    const reporterId = await requireAuthUserId(ctx, 'You must be logged in to report content');

    // 2. Validate notes length if provided
    if (args.notes && args.notes.length > MAX_NOTES_LENGTH) {
      throw new ConvexError(`Notes must be ${MAX_NOTES_LENGTH} characters or less`);
    }

    // 5. Validate target exists and handle malformed IDs
    let isAlreadyHidden = false;
    try {
      if (args.targetType === 'listing') {
        const listing = await ctx.db.get(args.targetId as Id<'listings'>);
        if (!listing) {
          throw new ConvexError('Listing not found');
        }
        isAlreadyHidden = !!listing.isHidden;
      } else if (args.targetType === 'profile') {
        const profile = await ctx.db.get(args.targetId as Id<'profiles'>);
        if (!profile) {
          throw new ConvexError('Profile not found');
        }
        isAlreadyHidden = !!profile.isHidden;
      }
    } catch {
      // Handle malformed IDs by throwing user-friendly errors
      if (args.targetType === 'listing') {
        throw new ConvexError('Listing not found');
      } else {
        throw new ConvexError('Profile not found');
      }
    }

    // 6. Check for duplicate report (same user + same target)
    const existingReport = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.targetId).eq('targetType', args.targetType)
      )
      .filter((q) => q.eq(q.field('reporterId'), reporterId))
      .first();

    if (existingReport) {
      throw new ConvexError('You have already reported this content');
    }

    // 6. Check rate limiting (max 10 reports per day)
    const oneDayAgo = Date.now() - ONE_DAY_MS;
    const recentReports = await ctx.db
      .query('reports')
      .withIndex('by_reporter', (q) => q.eq('reporterId', reporterId))
      .filter((q) => q.gt(q.field('createdAt'), oneDayAgo))
      .collect();

    if (recentReports.length >= MAX_REPORTS_PER_DAY) {
      throw new ConvexError('Report limit reached. Please try again later.');
    }

    // 7. Create the report
    const reportId = await ctx.db.insert('reports', {
      targetId: args.targetId,
      targetType: args.targetType,
      reporterId: reporterId,
      reason: args.reason,
      notes: args.notes,
      createdAt: Date.now(),
    });

    // 8. Check if content should be auto-hidden
    // Count all reports for this target
    const allReports = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.targetId).eq('targetType', args.targetType)
      )
      .collect();

    // Count unique reporters using Set
    const uniqueReporters = new Set(allReports.map((r) => r.reporterId)).size;

    // If threshold reached, hide the content
    if (uniqueReporters >= REPORT_THRESHOLD && !isAlreadyHidden) {
      if (args.targetType === 'listing') {
        await ctx.db.patch(args.targetId as Id<'listings'>, {
          isHidden: true,
          hiddenAt: Date.now(),
          hiddenReason: 'auto_moderation',
        });
      } else if (args.targetType === 'profile') {
        await ctx.db.patch(args.targetId as Id<'profiles'>, {
          isHidden: true,
          hiddenAt: Date.now(),
          hiddenReason: 'auto_moderation',
        });
      }
    }

    return reportId;
  },
});

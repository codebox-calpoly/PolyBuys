import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/authIdentity';

/**
 * Admin moderation queries and mutations.
 * All functions require the caller to have isAdmin === true on their user record.
 */

// --- Queries ---

/**
 * Get paginated reports for the admin moderation queue.
 * Supports filtering by status and targetType.
 * Null status on a report is treated as 'pending'.
 */
export const getReports = query({
  args: {
    status: v.optional(
      v.union(v.literal('pending'), v.literal('reviewed'), v.literal('dismissed'))
    ),
    targetType: v.optional(v.union(v.literal('listing'), v.literal('profile'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(args.limit ?? 50, 100);

    // Fetch reports ordered by newest first
    let allReports = await ctx.db.query('reports').order('desc').take(500);

    // Filter by status (null treated as pending)
    if (args.status) {
      allReports = allReports.filter((r) => {
        const reportStatus = r.status ?? 'pending';
        return reportStatus === args.status;
      });
    }

    // Filter by targetType
    if (args.targetType) {
      allReports = allReports.filter((r) => r.targetType === args.targetType);
    }

    // Limit results
    const reports = allReports.slice(0, limit);

    // Enrich with target and reporter context
    const enriched = await Promise.all(
      reports.map(async (report) => {
        let targetTitle: string | null = null;
        let targetImage: string | null = null;
        let targetIsHidden = false;

        if (report.targetType === 'listing') {
          const listing = await ctx.db.get(report.targetId as Id<'listings'>).catch(() => null);
          if (listing) {
            targetTitle = listing.title;
            targetImage = listing.images?.[0] ?? null;
            targetIsHidden = listing.isHidden === true;
          }
        } else if (report.targetType === 'profile') {
          const profile = await ctx.db.get(report.targetId as Id<'profiles'>).catch(() => null);
          if (profile) {
            targetTitle = profile.name;
            targetIsHidden = profile.isHidden === true;
          }
        }

        // Get reporter profile name
        const reporterProfile = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', report.reporterId))
          .first();

        return {
          ...report,
          status: report.status ?? 'pending',
          targetTitle,
          targetImage,
          targetIsHidden,
          reporterName: reporterProfile?.name ?? 'Unknown user',
        };
      })
    );

    return enriched;
  },
});

/**
 * Get detailed view of a single report with full target context and all reports for that target.
 */
export const getReportDetail = query({
  args: { reportId: v.id('reports') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError('Report not found');
    }

    // Get full target data
    let target: Record<string, unknown> | null = null;
    if (report.targetType === 'listing') {
      const listing = await ctx.db.get(report.targetId as Id<'listings'>).catch(() => null);
      target = listing ? { ...listing } : null;
    } else if (report.targetType === 'profile') {
      const profile = await ctx.db.get(report.targetId as Id<'profiles'>).catch(() => null);
      target = profile ? { ...profile } : null;
    }

    // Get all reports for this target
    const allTargetReports = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', report.targetId).eq('targetType', report.targetType)
      )
      .collect();

    // Enrich each report with reporter name
    const enrichedReports = await Promise.all(
      allTargetReports.map(async (r) => {
        const reporterProfile = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', r.reporterId))
          .first();
        return {
          ...r,
          status: r.status ?? 'pending',
          reporterName: reporterProfile?.name ?? 'Unknown user',
        };
      })
    );

    // Get reporter profile for the primary report
    const reporterProfile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', report.reporterId))
      .first();

    return {
      report: {
        ...report,
        status: report.status ?? 'pending',
        reporterName: reporterProfile?.name ?? 'Unknown user',
      },
      target,
      allReportsForTarget: enrichedReports,
      uniqueReporterCount: new Set(allTargetReports.map((r) => r.reporterId)).size,
    };
  },
});

/**
 * Get summary stats for the admin dashboard.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allReports = await ctx.db.query('reports').collect();

    const pending = allReports.filter((r) => (r.status ?? 'pending') === 'pending').length;
    const reviewed = allReports.filter((r) => r.status === 'reviewed').length;
    const dismissed = allReports.filter((r) => r.status === 'dismissed').length;

    // Count hidden listings
    const hiddenListings = await ctx.db
      .query('listings')
      .filter((q) => q.eq(q.field('isHidden'), true))
      .collect();

    // Count hidden profiles
    const hiddenProfiles = await ctx.db
      .query('profiles')
      .filter((q) => q.eq(q.field('isHidden'), true))
      .collect();

    return {
      pendingReports: pending,
      reviewedReports: reviewed,
      dismissedReports: dismissed,
      totalReports: allReports.length,
      hiddenListings: hiddenListings.length,
      hiddenProfiles: hiddenProfiles.length,
    };
  },
});

/**
 * Check if the current user is an admin.
 */
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

// --- Mutations ---

/**
 * Resolve a report by marking it as reviewed or dismissed.
 * Optionally hides the target content.
 */
export const resolveReport = mutation({
  args: {
    reportId: v.id('reports'),
    resolution: v.union(v.literal('reviewed'), v.literal('dismissed')),
    hideTarget: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError('Report not found');
    }

    // Update report status
    await ctx.db.patch(args.reportId, {
      status: args.resolution,
      reviewedBy: adminId,
      reviewedAt: Date.now(),
    });

    // Optionally hide the target
    if (args.hideTarget) {
      if (report.targetType === 'listing') {
        const listing = await ctx.db.get(report.targetId as Id<'listings'>);
        if (listing && !listing.isHidden) {
          await ctx.db.patch(report.targetId as Id<'listings'>, {
            isHidden: true,
            hiddenAt: Date.now(),
            hiddenReason: 'admin_action',
          });
        }
      } else if (report.targetType === 'profile') {
        const profile = await ctx.db.get(report.targetId as Id<'profiles'>);
        if (profile && !profile.isHidden) {
          await ctx.db.patch(report.targetId as Id<'profiles'>, {
            isHidden: true,
            hiddenAt: Date.now(),
            hiddenReason: 'admin_action',
          });
        }
      }
    }
  },
});

/**
 * Bulk resolve all reports for a given target.
 */
export const resolveAllForTarget = mutation({
  args: {
    targetId: v.string(),
    targetType: v.union(v.literal('listing'), v.literal('profile')),
    resolution: v.union(v.literal('reviewed'), v.literal('dismissed')),
    hideTarget: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const reports = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.targetId).eq('targetType', args.targetType)
      )
      .collect();

    // Update all pending reports for this target
    for (const report of reports) {
      if ((report.status ?? 'pending') === 'pending') {
        await ctx.db.patch(report._id, {
          status: args.resolution,
          reviewedBy: adminId,
          reviewedAt: Date.now(),
        });
      }
    }

    // Optionally hide the target
    if (args.hideTarget) {
      if (args.targetType === 'listing') {
        const listing = await ctx.db.get(args.targetId as Id<'listings'>);
        if (listing && !listing.isHidden) {
          await ctx.db.patch(args.targetId as Id<'listings'>, {
            isHidden: true,
            hiddenAt: Date.now(),
            hiddenReason: 'admin_action',
          });
        }
      } else if (args.targetType === 'profile') {
        const profile = await ctx.db.get(args.targetId as Id<'profiles'>);
        if (profile && !profile.isHidden) {
          await ctx.db.patch(args.targetId as Id<'profiles'>, {
            isHidden: true,
            hiddenAt: Date.now(),
            hiddenReason: 'admin_action',
          });
        }
      }
    }
  },
});

/**
 * Manually hide a listing or profile.
 */
export const hideContent = mutation({
  args: {
    targetId: v.string(),
    targetType: v.union(v.literal('listing'), v.literal('profile')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.targetType === 'listing') {
      const listing = await ctx.db.get(args.targetId as Id<'listings'>);
      if (!listing) throw new ConvexError('Listing not found');
      if (listing.isHidden) return; // Already hidden
      await ctx.db.patch(args.targetId as Id<'listings'>, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'admin_action',
      });
    } else {
      const profile = await ctx.db.get(args.targetId as Id<'profiles'>);
      if (!profile) throw new ConvexError('Profile not found');
      if (profile.isHidden) return;
      await ctx.db.patch(args.targetId as Id<'profiles'>, {
        isHidden: true,
        hiddenAt: Date.now(),
        hiddenReason: 'admin_action',
      });
    }
  },
});

/**
 * Unhide a listing or profile.
 */
export const unhideContent = mutation({
  args: {
    targetId: v.string(),
    targetType: v.union(v.literal('listing'), v.literal('profile')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.targetType === 'listing') {
      const listing = await ctx.db.get(args.targetId as Id<'listings'>);
      if (!listing) throw new ConvexError('Listing not found');
      if (!listing.isHidden) return;
      await ctx.db.patch(args.targetId as Id<'listings'>, {
        isHidden: false,
        hiddenAt: undefined,
        hiddenReason: undefined,
      });
    } else {
      const profile = await ctx.db.get(args.targetId as Id<'profiles'>);
      if (!profile) throw new ConvexError('Profile not found');
      if (!profile.isHidden) return;
      await ctx.db.patch(args.targetId as Id<'profiles'>, {
        isHidden: false,
        hiddenAt: undefined,
        hiddenReason: undefined,
      });
    }
  },
});

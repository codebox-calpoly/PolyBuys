import { v, ConvexError } from 'convex/values';
import { mutation } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const MAX_NOTES_LENGTH = 500;
const MAX_REPORTS_PER_DAY = 10;
const MAX_TARGET_REPORTS_PER_DAY = 30;
const REPORT_THRESHOLD = 3; // Number of unique reporters before auto-hide
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_KEY_DUPLICATE_SCAN = 25;
const UNIQUE_REPORTER_SCAN_BATCH_SIZE = 50;
const MAX_UNIQUE_REPORTER_SCAN = 500;
const QUALIFIED_REPORTER_MIN_ACCOUNT_AGE_MS = 60 * 60 * 1000; // 1 hour

type ReporterQualification = {
  eligible: boolean;
  relatedAccountKey: string;
};

function isMalformedIdLookupError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  // Convex throws non-ConvexError runtime errors when an arbitrary string is used as an Id<T>.
  return /invalid\s+.*id|id\s+.*invalid|unable to decode id|not a valid id|malformed id|document id/i.test(
    error.message
  );
}

function buildReportKey(targetType: 'listing' | 'profile', targetId: string, reporterId: string) {
  return `${targetType}|${targetId}|${reporterId}`;
}

function canonicalizeReporterEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  // Collapse plus aliases so closely-related addresses count once.
  const localPart = normalized.slice(0, atIndex).split('+')[0];
  const domainPart = normalized.slice(atIndex + 1);
  if (localPart.length === 0) {
    return null;
  }
  return `${localPart}@${domainPart}`;
}

async function getReporterQualification(args: {
  ctx: MutationCtx;
  reporterId: string;
  now: number;
  cache: Map<string, ReporterQualification>;
}) {
  const cached = args.cache.get(args.reporterId);
  if (cached) {
    return cached;
  }

  const profile: Doc<'profiles'> | null = await args.ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', args.reporterId))
    .unique();

  const canonicalEmail = profile?.email ? canonicalizeReporterEmail(profile.email) : null;
  const relatedAccountKey = canonicalEmail ? `email:${canonicalEmail}` : `id:${args.reporterId}`;
  let hasVisibleProfile = false;
  let hasCalPolyEmail = false;
  let hasMinimumAccountAge = false;
  if (profile) {
    hasVisibleProfile = profile.isHidden !== true;
    hasCalPolyEmail = profile.email.trim().toLowerCase().endsWith('@calpoly.edu');
    hasMinimumAccountAge = args.now - profile.joinDate >= QUALIFIED_REPORTER_MIN_ACCOUNT_AGE_MS;
  }

  const qualification: ReporterQualification = {
    eligible: hasVisibleProfile && hasCalPolyEmail && hasMinimumAccountAge,
    relatedAccountKey,
  };
  args.cache.set(args.reporterId, qualification);
  return qualification;
}

async function hasAtLeastUniqueReportersForTarget(args: {
  ctx: MutationCtx;
  targetId: string;
  targetType: 'listing' | 'profile';
  minimumUniqueReporters: number;
}) {
  let cursor: string | null = null;
  let scanned = 0;
  const qualifiedReporterKeys = new Set<string>();
  const qualificationCache = new Map<string, ReporterQualification>();
  const now = Date.now();

  while (
    qualifiedReporterKeys.size < args.minimumUniqueReporters &&
    scanned < MAX_UNIQUE_REPORTER_SCAN
  ) {
    const page = await args.ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.targetId).eq('targetType', args.targetType)
      )
      .paginate({
        numItems: UNIQUE_REPORTER_SCAN_BATCH_SIZE,
        cursor,
      });

    for (const report of page.page) {
      const qualification = await getReporterQualification({
        ctx: args.ctx,
        reporterId: report.reporterId,
        now,
        cache: qualificationCache,
      });
      if (!qualification.eligible) {
        continue;
      }
      qualifiedReporterKeys.add(qualification.relatedAccountKey);
      if (qualifiedReporterKeys.size >= args.minimumUniqueReporters) {
        return true;
      }
    }

    scanned += page.page.length;
    if (page.isDone) {
      return false;
    }
    cursor = page.continueCursor;
  }

  return qualifiedReporterKeys.size >= args.minimumUniqueReporters;
}

async function hasAtLeastUniqueReportersForTargetSince(args: {
  ctx: MutationCtx;
  targetId: string;
  targetType: 'listing' | 'profile';
  minimumCreatedAtExclusive: number;
  minimumUniqueReporters: number;
}) {
  let cursor: string | null = null;
  let scanned = 0;
  const qualifiedReporterKeys = new Set<string>();
  const qualificationCache = new Map<string, ReporterQualification>();
  const now = Date.now();

  while (
    qualifiedReporterKeys.size < args.minimumUniqueReporters &&
    scanned < MAX_UNIQUE_REPORTER_SCAN
  ) {
    const page = await args.ctx.db
      .query('reports')
      .withIndex('by_target_createdAt', (q) =>
        q
          .eq('targetId', args.targetId)
          .eq('targetType', args.targetType)
          .gt('createdAt', args.minimumCreatedAtExclusive)
      )
      .paginate({
        numItems: UNIQUE_REPORTER_SCAN_BATCH_SIZE,
        cursor,
      });

    for (const report of page.page) {
      const qualification = await getReporterQualification({
        ctx: args.ctx,
        reporterId: report.reporterId,
        now,
        cache: qualificationCache,
      });
      if (!qualification.eligible) {
        continue;
      }
      qualifiedReporterKeys.add(qualification.relatedAccountKey);
      if (qualifiedReporterKeys.size >= args.minimumUniqueReporters) {
        return true;
      }
    }

    scanned += page.page.length;
    if (page.isDone) {
      return false;
    }
    cursor = page.continueCursor;
  }

  return qualifiedReporterKeys.size >= args.minimumUniqueReporters;
}

async function reconcileReportKeyDuplicates(args: {
  ctx: MutationCtx;
  reportKey: string;
  insertedReportId: Id<'reports'>;
}) {
  const matches = await args.ctx.db
    .query('reports')
    .withIndex('by_report_key', (q) => q.eq('reportKey', args.reportKey))
    .take(MAX_REPORT_KEY_DUPLICATE_SCAN);

  if (matches.length <= 1) {
    return args.insertedReportId;
  }

  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt || (a._id < b._id ? -1 : 1));
  const canonical = sorted[0];

  for (const duplicate of sorted.slice(1)) {
    if (duplicate._id === canonical._id) {
      continue;
    }
    try {
      await args.ctx.db.delete(duplicate._id);
    } catch {
      // Best-effort cleanup in concurrent report submissions.
    }
  }

  return canonical._id;
}

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

    const reporterId = identity.subject;

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
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      // Only map malformed-ID lookup errors to not-found. Re-throw infra/runtime issues.
      if (isMalformedIdLookupError(error)) {
        if (args.targetType === 'listing') {
          throw new ConvexError('Listing not found');
        }
        throw new ConvexError('Profile not found');
      }
      throw error;
    }

    const reportKey = buildReportKey(args.targetType, args.targetId, reporterId);

    // 6. Check for duplicate report (same user + same target) — O(1) via compound index
    const [existingReportByKey, existingReportByTuple] = await Promise.all([
      ctx.db
        .query('reports')
        .withIndex('by_report_key', (q) => q.eq('reportKey', reportKey))
        .first(),
      ctx.db
        .query('reports')
        .withIndex('by_target_reporter', (q) =>
          q
            .eq('targetId', args.targetId)
            .eq('targetType', args.targetType)
            .eq('reporterId', reporterId)
        )
        .first(),
    ]);

    if (existingReportByKey || existingReportByTuple) {
      throw new ConvexError('You have already reported this content');
    }

    // 6. Check rate limiting (max 10 reports per day)
    // Use take(MAX_REPORTS_PER_DAY + 1) instead of collect() to avoid an unbounded
    // read — we only need to know whether the count has reached the limit.
    const oneDayAgo = Date.now() - ONE_DAY_MS;
    const recentReports = await ctx.db
      .query('reports')
      .withIndex('by_reporter_createdAt', (q) =>
        q.eq('reporterId', reporterId).gt('createdAt', oneDayAgo)
      )
      .take(MAX_REPORTS_PER_DAY + 1);

    if (recentReports.length >= MAX_REPORTS_PER_DAY) {
      throw new ConvexError('Report limit reached. Please try again later.');
    }

    // 7. Guard against flood attacks on a single target.
    const targetDailyUniqueLimitReached = await hasAtLeastUniqueReportersForTargetSince({
      ctx,
      targetId: args.targetId,
      targetType: args.targetType,
      minimumCreatedAtExclusive: oneDayAgo,
      minimumUniqueReporters: MAX_TARGET_REPORTS_PER_DAY,
    });

    if (targetDailyUniqueLimitReached) {
      throw new ConvexError('This content is already under review. Please try again later.');
    }

    // 8. Create the report
    const insertedReportId = await ctx.db.insert('reports', {
      targetId: args.targetId,
      targetType: args.targetType,
      reporterId: reporterId,
      reportKey,
      reason: args.reason,
      notes: args.notes,
      createdAt: Date.now(),
    });

    const canonicalReportId = await reconcileReportKeyDuplicates({
      ctx,
      reportKey,
      insertedReportId,
    });

    if (canonicalReportId !== insertedReportId) {
      throw new ConvexError('You have already reported this content');
    }

    // 9. Check if content should be auto-hidden
    const thresholdReached = await hasAtLeastUniqueReportersForTarget({
      ctx,
      targetId: args.targetId,
      targetType: args.targetType,
      minimumUniqueReporters: REPORT_THRESHOLD,
    });

    // If threshold reached, hide the content
    if (thresholdReached && !isAlreadyHidden) {
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

    return insertedReportId;
  },
});

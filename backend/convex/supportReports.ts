import { ConvexError, v } from 'convex/values';
import {
  SUPPORT_REPORT_CONTEXT_VALUE_MAX,
  SUPPORT_REPORT_DESCRIPTION_MAX,
  SUPPORT_REPORTS_PER_DAY,
  SUPPORT_REPORTS_PER_TEN_MINUTES,
} from '@polybuys/shared';
import { mutation } from './_generated/server';
import { requireAuthUserId } from './lib/authIdentity';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type SupportReportContext = {
  platform?: string;
  appVersion?: string;
  osVersion?: string;
  route?: string;
  listingId?: string;
  conversationId?: string;
};

function cleanOptionalText(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function cleanContext(context: SupportReportContext | undefined) {
  if (!context) {
    return undefined;
  }

  const cleaned: SupportReportContext = {};
  const platform = cleanOptionalText(context.platform, SUPPORT_REPORT_CONTEXT_VALUE_MAX);
  const appVersion = cleanOptionalText(context.appVersion, SUPPORT_REPORT_CONTEXT_VALUE_MAX);
  const osVersion = cleanOptionalText(context.osVersion, SUPPORT_REPORT_CONTEXT_VALUE_MAX);
  const route = cleanOptionalText(context.route, SUPPORT_REPORT_CONTEXT_VALUE_MAX);
  const listingId = cleanOptionalText(context.listingId, SUPPORT_REPORT_CONTEXT_VALUE_MAX);
  const conversationId = cleanOptionalText(
    context.conversationId,
    SUPPORT_REPORT_CONTEXT_VALUE_MAX
  );

  if (platform) cleaned.platform = platform;
  if (appVersion) cleaned.appVersion = appVersion;
  if (osVersion) cleaned.osVersion = osVersion;
  if (route) cleaned.route = route;
  if (listingId) cleaned.listingId = listingId;
  if (conversationId) cleaned.conversationId = conversationId;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export const submitSupportReport = mutation({
  args: {
    category: v.union(
      v.literal('bug'),
      v.literal('account_login'),
      v.literal('listing'),
      v.literal('messages'),
      v.literal('payments_offers'),
      v.literal('safety'),
      v.literal('other')
    ),
    description: v.string(),
    context: v.optional(
      v.object({
        platform: v.optional(v.string()),
        appVersion: v.optional(v.string()),
        osVersion: v.optional(v.string()),
        route: v.optional(v.string()),
        listingId: v.optional(v.string()),
        conversationId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const reporterId = await requireAuthUserId(ctx, 'You must be logged in to report a problem');
    const description = args.description.trim();

    if (!description) {
      throw new ConvexError('Description is required');
    }

    if (description.length > SUPPORT_REPORT_DESCRIPTION_MAX) {
      throw new ConvexError(
        `Description must be ${SUPPORT_REPORT_DESCRIPTION_MAX} characters or less`
      );
    }

    const now = Date.now();
    const recentCutoff = now - TEN_MINUTES_MS;
    const recentReports = await ctx.db
      .query('supportReports')
      .withIndex('by_reporter_createdAt', (q) =>
        q.eq('reporterId', reporterId).gt('createdAt', recentCutoff)
      )
      .collect();

    const matchingRecentReport = recentReports.find(
      (report) => report.category === args.category && report.description === description
    );
    if (matchingRecentReport) {
      throw new ConvexError('You already submitted this problem recently.');
    }

    if (recentReports.length >= SUPPORT_REPORTS_PER_TEN_MINUTES) {
      throw new ConvexError('Support report limit reached. Please try again later.');
    }

    const oneDayAgo = now - ONE_DAY_MS;
    const dailyReports = await ctx.db
      .query('supportReports')
      .withIndex('by_reporter_createdAt', (q) =>
        q.eq('reporterId', reporterId).gt('createdAt', oneDayAgo)
      )
      .collect();
    if (dailyReports.length >= SUPPORT_REPORTS_PER_DAY) {
      throw new ConvexError('Support report limit reached. Please try again later.');
    }

    const identity = await ctx.auth.getUserIdentity();
    const reporterEmail = cleanOptionalText(identity?.email?.toLowerCase(), 320);
    const supportReportId = await ctx.db.insert('supportReports', {
      reporterId,
      reporterEmail,
      category: args.category,
      description,
      context: cleanContext(args.context),
      createdAt: now,
    });

    return { supportReportId };
  },
});

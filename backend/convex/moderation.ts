import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { internal } from './_generated/api';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const PREVIEW_MAX_CHARS = 160;
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 200;
const LEGACY_CONTENT_TYPES = ['listing', 'message'] as const;
const MODERATION_TIMEOUT_MS = 8_000;

const SHADOW_DEFAULT_BATCH = 20;
const SHADOW_MAX_BATCH = 50;
const SHADOW_MAX_ATTEMPTS = 6;
const SHADOW_RETRY_BASE_MS = 30_000;
const SHADOW_RETRY_MAX_MS = 30 * 60 * 1000;
const SHADOW_REDACTED_MESSAGE = '[Message removed by automated safety review]';

type ContentType = 'listing' | 'message';
type AlertType = 'provider_degraded' | 'shadow_flagged' | 'shadow_failed';
type ModerationCheck = {
  flagged: boolean;
  categories: Record<string, boolean>;
  degraded: boolean;
  degradeReason?: string;
};

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'],
  [/\bhttps?:\/\/\S+\b/gi, '[url]'],
  [/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[phone]'],
  [/\b\d{6,}\b/g, '[number]'],
];

function buildRedactedPreview(input: string) {
  let normalized = input.replace(/\s+/g, ' ').trim();
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  if (normalized.length === 0) {
    return '[empty]';
  }
  if (normalized.length <= PREVIEW_MAX_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_MAX_CHARS)}...`;
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function degradedModeration(reason: string): ModerationCheck {
  return { flagged: false, categories: {}, degraded: true, degradeReason: reason };
}

function computeShadowRetryDelayMs(attemptCount: number) {
  const exponential = SHADOW_RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(SHADOW_RETRY_MAX_MS, exponential);
}

async function insertModerationAlert(
  ctx: MutationCtx,
  args: {
    alertType: AlertType;
    contentType?: ContentType;
    contentId?: string;
    queueId?: Id<'shadowModerationQueue'>;
    detail?: string;
  }
) {
  const now = Date.now();
  await ctx.db.insert('moderationAlerts', {
    alertType: args.alertType,
    contentType: args.contentType,
    contentId: args.contentId,
    queueId: args.queueId,
    detail: args.detail,
    createdAt: now,
  });

  const line = `[moderation-alert] type=${args.alertType} contentType=${args.contentType ?? 'n/a'} contentId=${args.contentId ?? 'n/a'} detail=${args.detail ?? 'n/a'}`;
  if (args.alertType === 'shadow_failed') {
    console.error(line);
  } else {
    console.warn(line);
  }
}

async function insertModerationResultAndCleanup(
  ctx: MutationCtx,
  args: {
    contentType: ContentType;
    contentId?: string;
    inputTextHash: string;
    inputTextPreview: string;
    flagged: boolean;
    categories?: string;
    userId: string;
  }
) {
  const now = Date.now();
  await ctx.db.insert('moderationResults', {
    contentType: args.contentType,
    contentId: args.contentId,
    inputTextHash: args.inputTextHash,
    inputTextPreview: args.inputTextPreview,
    flagged: args.flagged,
    categories: args.categories,
    userId: args.userId,
    createdAt: now,
    expiresAt: now + RETENTION_MS,
  });

  // Opportunistic TTL cleanup: bounded batch, index-backed.
  const expired = await ctx.db
    .query('moderationResults')
    .withIndex('by_expiresAt', (q) => q.lte('expiresAt', now))
    .take(CLEANUP_BATCH);

  // Legacy rows may have no expiresAt. Enforce retention by createdAt as fallback.
  const retentionCutoff = now - RETENTION_MS;
  const legacy = (
    await Promise.all(
      LEGACY_CONTENT_TYPES.map((contentType) =>
        ctx.db
          .query('moderationResults')
          .withIndex('by_contentType', (q) =>
            q.eq('contentType', contentType).lt('createdAt', retentionCutoff)
          )
          .take(CLEANUP_BATCH)
      )
    )
  ).flat();

  const idsToDelete = new Set([...expired, ...legacy].map((row) => row._id));
  for (const rowId of idsToDelete) {
    await ctx.db.delete(rowId);
  }
}

async function callOpenAIModeration(text: string): Promise<ModerationCheck> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return degradedModeration('missing_api_key');
  }

  const controller = new AbortController();
  const moderationTimeout = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.warn(`[moderation] OpenAI API returned ${response.status}: ${errorBody}`);
      return degradedModeration(`http_${response.status}`);
    }

    const data = await response.json().catch(() => null);
    const rawResult = data?.results?.[0];
    if (!rawResult || typeof rawResult !== 'object') {
      console.warn('[moderation] Unexpected API response shape');
      return degradedModeration('unexpected_response_shape');
    }

    const flagged = Boolean((rawResult as { flagged?: unknown }).flagged);
    const categoriesValue = (rawResult as { categories?: unknown }).categories;
    const categories =
      categoriesValue && typeof categoriesValue === 'object'
        ? (categoriesValue as Record<string, boolean>)
        : {};

    return { flagged, categories, degraded: false };
  } catch (error) {
    console.warn('[moderation] OpenAI API call failed:', error);
    return degradedModeration(error instanceof Error ? error.name.toLowerCase() : 'request_failed');
  } finally {
    clearTimeout(moderationTimeout);
  }
}

/**
 * Screens text content against the OpenAI Moderation API.
 *
 * - Returns { flagged, categories } on success.
 * - Gracefully degrades: if the API is unreachable or errors, returns { flagged: false, degraded: true }
 *   so content is never blocked by outages.
 */
export const moderateContent = internalAction({
  args: {
    text: v.string(),
    contentType: v.union(v.literal('listing'), v.literal('message')),
    userId: v.string(),
    contentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const moderation = await callOpenAIModeration(args.text);
    if (moderation.degraded) {
      console.warn(
        `[moderation] Provider degraded (${moderation.degradeReason ?? 'unknown'}) — allowing content through`
      );
      return moderation;
    }

    const inputTextHash = await sha256Hex(args.text);
    const inputTextPreview = buildRedactedPreview(args.text);

    await ctx.runMutation(internal.moderation.logModerationResult, {
      contentType: args.contentType,
      contentId: args.contentId,
      inputTextHash,
      inputTextPreview,
      flagged: moderation.flagged,
      categories: JSON.stringify(moderation.categories),
      userId: args.userId,
    });

    return moderation;
  },
});

/**
 * Persists a moderation result to the audit log table.
 */
export const logModerationResult = internalMutation({
  args: {
    contentType: v.union(v.literal('listing'), v.literal('message')),
    contentId: v.optional(v.string()),
    inputTextHash: v.string(),
    inputTextPreview: v.string(),
    flagged: v.boolean(),
    categories: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await insertModerationResultAndCleanup(ctx, args);
  },
});

export const enqueueShadowModeration = internalMutation({
  args: {
    contentType: v.union(v.literal('listing'), v.literal('message')),
    contentId: v.string(),
    userId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('shadowModerationQueue')
      .withIndex('by_content', (q) =>
        q.eq('contentType', args.contentType).eq('contentId', args.contentId)
      )
      .take(20);
    const openItem = existing.find(
      (item) => item.status === 'pending' || item.status === 'processing'
    );
    if (openItem) {
      return { queueId: openItem._id, enqueued: false };
    }

    const now = Date.now();
    const queueId = await ctx.db.insert('shadowModerationQueue', {
      contentType: args.contentType,
      contentId: args.contentId,
      userId: args.userId,
      reason: args.reason,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await insertModerationAlert(ctx, {
      alertType: 'provider_degraded',
      contentType: args.contentType,
      contentId: args.contentId,
      queueId,
      detail: args.reason,
    });
    return { queueId, enqueued: true };
  },
});

export const getDueShadowModerationItems = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? SHADOW_DEFAULT_BATCH, SHADOW_MAX_BATCH));
    return await ctx.db
      .query('shadowModerationQueue')
      .withIndex('by_status_nextAttemptAt', (q) =>
        q.eq('status', 'pending').lte('nextAttemptAt', now)
      )
      .take(limit);
  },
});

export const claimShadowModerationItem = internalMutation({
  args: { queueId: v.id('shadowModerationQueue') },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.queueId);
    const now = Date.now();
    if (!row || row.status !== 'pending' || row.nextAttemptAt > now) {
      return { claimed: false, attemptCount: row?.attemptCount ?? 0 };
    }

    await ctx.db.patch(args.queueId, {
      status: 'processing',
      attemptCount: row.attemptCount + 1,
      processingStartedAt: now,
      updatedAt: now,
      lastError: undefined,
    });
    return { claimed: true, attemptCount: row.attemptCount + 1 };
  },
});

export const resolveShadowModerationText = internalQuery({
  args: {
    contentType: v.union(v.literal('listing'), v.literal('message')),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      if (args.contentType === 'listing') {
        const listing = await ctx.db.get(args.contentId as Id<'listings'>);
        if (!listing) {
          return null;
        }
        return `${listing.title} ${listing.description}`;
      }

      const message = await ctx.db.get(args.contentId as Id<'messages'>);
      if (!message) {
        return null;
      }
      return message.body;
    } catch {
      return null;
    }
  },
});

export const markShadowModerationNoContent = internalMutation({
  args: { queueId: v.id('shadowModerationQueue') },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.queueId);
    if (!row || row.status !== 'processing') {
      return { updated: false };
    }

    await ctx.db.patch(args.queueId, {
      status: 'completed',
      lastError: 'content_unavailable',
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
    return { updated: true };
  },
});

export const markShadowModerationRetry = internalMutation({
  args: {
    queueId: v.id('shadowModerationQueue'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.queueId);
    if (!row || row.status !== 'processing') {
      return { state: 'stale' as const };
    }

    const now = Date.now();
    if (row.attemptCount >= SHADOW_MAX_ATTEMPTS) {
      await ctx.db.patch(args.queueId, {
        status: 'failed',
        nextAttemptAt: now,
        lastError: args.error,
        processingStartedAt: undefined,
        updatedAt: now,
      });
      await insertModerationAlert(ctx, {
        alertType: 'shadow_failed',
        contentType: row.contentType,
        contentId: row.contentId,
        queueId: row._id,
        detail: args.error,
      });
      return { state: 'failed' as const };
    }

    const delayMs = computeShadowRetryDelayMs(row.attemptCount);
    const nextAttemptAt = now + delayMs;
    await ctx.db.patch(args.queueId, {
      status: 'pending',
      nextAttemptAt,
      lastError: args.error,
      processingStartedAt: undefined,
      updatedAt: now,
    });

    return { state: 'retrying' as const, nextAttemptAt };
  },
});

export const applyShadowModerationResult = internalMutation({
  args: {
    queueId: v.id('shadowModerationQueue'),
    flagged: v.boolean(),
    categories: v.optional(v.string()),
    inputTextHash: v.string(),
    inputTextPreview: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.queueId);
    if (!row || row.status !== 'processing') {
      return { applied: false };
    }

    const now = Date.now();
    await insertModerationResultAndCleanup(ctx, {
      contentType: row.contentType,
      contentId: row.contentId,
      inputTextHash: args.inputTextHash,
      inputTextPreview: args.inputTextPreview,
      flagged: args.flagged,
      categories: args.categories,
      userId: row.userId,
    });

    if (args.flagged) {
      if (row.contentType === 'listing') {
        try {
          const listing = await ctx.db.get(row.contentId as Id<'listings'>);
          if (listing && !listing.isHidden) {
            await ctx.db.patch(listing._id, {
              isHidden: true,
              hiddenAt: now,
              hiddenReason: 'shadow_moderation',
            });
          }
        } catch {
          // Ignore malformed IDs and continue queue lifecycle.
        }
      } else {
        try {
          const message = await ctx.db.get(row.contentId as Id<'messages'>);
          if (message) {
            await ctx.db.patch(message._id, {
              body: SHADOW_REDACTED_MESSAGE,
              type: 'system',
            });
          }
        } catch {
          // Ignore malformed IDs and continue queue lifecycle.
        }
      }

      await ctx.db.patch(args.queueId, {
        status: 'flagged',
        nextAttemptAt: now,
        lastError: undefined,
        processingStartedAt: undefined,
        updatedAt: now,
      });

      await insertModerationAlert(ctx, {
        alertType: 'shadow_flagged',
        contentType: row.contentType,
        contentId: row.contentId,
        queueId: row._id,
        detail: 'shadow moderation flagged content after fail-open fallback',
      });
      return { applied: true, state: 'flagged' as const };
    }

    await ctx.db.patch(args.queueId, {
      status: 'completed',
      nextAttemptAt: now,
      lastError: undefined,
      processingStartedAt: undefined,
      updatedAt: now,
    });
    return { applied: true, state: 'completed' as const };
  },
});

export const processShadowModerationQueue = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number; scanned: number }> => {
    const limit = Math.max(1, Math.min(args.limit ?? SHADOW_DEFAULT_BATCH, SHADOW_MAX_BATCH));
    const dueItems: Array<Pick<Doc<'shadowModerationQueue'>, '_id' | 'contentType' | 'contentId'>> =
      await ctx.runQuery(internal.moderation.getDueShadowModerationItems, { limit });

    let processed = 0;
    for (const item of dueItems) {
      const claimed = await ctx.runMutation(internal.moderation.claimShadowModerationItem, {
        queueId: item._id,
      });
      if (!claimed.claimed) {
        continue;
      }

      const text = await ctx.runQuery(internal.moderation.resolveShadowModerationText, {
        contentType: item.contentType,
        contentId: item.contentId,
      });
      if (!text || text.trim().length === 0) {
        await ctx.runMutation(internal.moderation.markShadowModerationNoContent, {
          queueId: item._id,
        });
        processed += 1;
        continue;
      }

      const moderation = await callOpenAIModeration(text);
      if (moderation.degraded) {
        await ctx.runMutation(internal.moderation.markShadowModerationRetry, {
          queueId: item._id,
          error: moderation.degradeReason ?? 'provider_degraded',
        });
        processed += 1;
        continue;
      }

      await ctx.runMutation(internal.moderation.applyShadowModerationResult, {
        queueId: item._id,
        flagged: moderation.flagged,
        categories: JSON.stringify(moderation.categories),
        inputTextHash: await sha256Hex(text),
        inputTextPreview: buildRedactedPreview(text),
      });
      processed += 1;
    }

    return { processed, scanned: dueItems.length };
  },
});

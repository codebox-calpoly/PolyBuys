import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const PREVIEW_MAX_CHARS = 160;
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 200;
const LEGACY_CONTENT_TYPES = ['listing', 'message'] as const;

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

/**
 * Screens text content against the OpenAI Moderation API.
 *
 * - Returns { flagged, categories } on success.
 * - Gracefully degrades: if the API is unreachable or errors, returns { flagged: false }
 *   and logs a warning so content is never blocked by outages.
 */
export const moderateContent = internalAction({
  args: {
    text: v.string(),
    contentType: v.union(v.literal('listing'), v.literal('message')),
    userId: v.string(),
    contentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('[moderation] OPENAI_API_KEY not set — skipping moderation');
      return { flagged: false, categories: {} };
    }

    let flagged = false;
    let categories: Record<string, boolean> = {};

    // 8-second timeout — consistent with fail-open policy: a hung API must never
    // block a listing or message from going through (DECISIONS.md: fail-open).
    const controller = new AbortController();
    const moderationTimeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(OPENAI_MODERATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: args.text,
        }),
        signal: controller.signal,
      });
      clearTimeout(moderationTimeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        console.warn(
          `[moderation] OpenAI API returned ${response.status}: ${errorBody} — allowing content through`
        );
        return { flagged: false, categories: {} };
      }

      const data = await response.json();
      const result = data.results?.[0];

      if (!result) {
        console.warn('[moderation] Unexpected API response shape — allowing content through');
        return { flagged: false, categories: {} };
      }

      flagged = result.flagged ?? false;
      categories = result.categories ?? {};
    } catch (error) {
      clearTimeout(moderationTimeout);
      // Graceful degradation: timeout (AbortError), network failure, etc.
      console.warn('[moderation] OpenAI API call failed — allowing content through:', error);
      return { flagged: false, categories: {} };
    }

    const inputTextHash = await sha256Hex(args.text);
    const inputTextPreview = buildRedactedPreview(args.text);

    // Log the moderation result for audit
    await ctx.runMutation(internal.moderation.logModerationResult, {
      contentType: args.contentType,
      contentId: args.contentId,
      inputTextHash,
      inputTextPreview,
      flagged,
      categories: JSON.stringify(categories),
      userId: args.userId,
    });

    return { flagged, categories };
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
  },
});

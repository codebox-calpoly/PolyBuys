import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { logWarn } from './lib/logger';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_TIMEOUT_MS = 5000;

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
      logWarn('moderation.skipped_missing_api_key', {
        contentType: args.contentType,
      });
      return { flagged: false, categories: {} };
    }

    let flagged = false;
    let categories: Record<string, boolean> = {};

    try {
      const response = await fetch(OPENAI_MODERATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: args.text,
        }),
      });

      if (!response.ok) {
        logWarn('moderation.upstream_non_ok', {
          contentType: args.contentType,
          status: response.status,
          statusText: response.statusText,
        });
        return { flagged: false, categories: {} };
      }

      const data = await response.json();
      const result = data.results?.[0];

      if (!result) {
        logWarn('moderation.unexpected_response_shape', {
          contentType: args.contentType,
        });
        return { flagged: false, categories: {} };
      }

      flagged = result.flagged ?? false;
      categories = result.categories ?? {};
    } catch (error) {
      // Graceful degradation: API unreachable, timeout, network error, etc.
      logWarn('moderation.upstream_failed', {
        contentType: args.contentType,
        error,
      });
      return { flagged: false, categories: {} };
    }

    // Log the moderation result for audit
    await ctx.runMutation(internal.moderation.logModerationResult, {
      contentType: args.contentType,
      contentId: args.contentId,
      inputText: args.text,
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
    inputText: v.string(),
    flagged: v.boolean(),
    categories: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('moderationResults', {
      contentType: args.contentType,
      contentId: args.contentId,
      inputText: args.inputText,
      flagged: args.flagged,
      categories: args.categories,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

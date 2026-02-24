import { v } from 'convex/values';
import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';

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
      });

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
      // Graceful degradation: API unreachable, network error, etc.
      console.warn('[moderation] OpenAI API call failed — allowing content through:', error);
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

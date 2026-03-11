import { v, ConvexError } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { requireAuthUserId } from './lib/authIdentity';

/**
 * Shared helper: check if there is a block between two users (either direction).
 * Used by internalHasBlockBetween and getOrCreateConversation (mutation) for consistency.
 */
export async function hasBlockBetween(
  ctx: { db: QueryCtx['db'] },
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  const [block1, block2] = await Promise.all([
    ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', userIdA).eq('blockedId', userIdB))
      .first(),
    ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', userIdB).eq('blockedId', userIdA))
      .first(),
  ]);
  return block1 !== null || block2 !== null;
}

/**
 * Block another user. Prevents messaging in both directions.
 */
export const blockUser = mutation({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);

    if (blockerId === args.blockedId) {
      throw new ConvexError('You cannot block yourself');
    }

    const existing = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', args.blockedId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const blockId = await ctx.db.insert('userBlocks', {
      blockerId,
      blockedId: args.blockedId,
      createdAt: Date.now(),
    });

    return blockId;
  },
});

/**
 * Unblock a previously blocked user.
 */
export const unblockUser = mutation({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);

    const existing = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', args.blockedId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { ok: true };
  },
});

/**
 * Check if the current user has blocked the given user.
 */
export const isBlocking = query({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const block = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', args.blockedId)
      )
      .first();
    return block !== null;
  },
});

/**
 * Internal: Check if there is a block between two users (either direction).
 * Used by messaging to enforce block in both directions.
 */
export const internalHasBlockBetween = internalQuery({
  args: {
    userIdA: v.string(),
    userIdB: v.string(),
  },
  handler: async (ctx, args) => {
    return await hasBlockBetween(ctx, args.userIdA, args.userIdB);
  },
});

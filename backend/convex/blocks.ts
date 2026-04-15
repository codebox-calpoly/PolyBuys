import { v, ConvexError } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { requireAuthUserId } from './lib/authIdentity';

type BlockedUserListRow = {
  blockedId: string;
  name: string;
  major?: string;
};

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

async function getValidatedPeerUserId(
  ctx: { db: QueryCtx['db'] },
  peerUserId: string
): Promise<string> {
  const normalizedPeerUserId = await ctx.db.normalizeId('users', peerUserId);
  if (!normalizedPeerUserId) {
    throw new ConvexError('Target user not found');
  }

  const peerUser = await ctx.db.get(normalizedPeerUserId);
  if (!peerUser) {
    throw new ConvexError('Target user not found');
  }

  return normalizedPeerUserId as string;
}

/**
 * Block another user. Prevents messaging in both directions.
 */
export const blockUser = mutation({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const blockedId = await getValidatedPeerUserId(ctx, args.blockedId);

    if (blockerId === blockedId) {
      throw new ConvexError('You cannot block yourself');
    }

    const existing = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const blockId = await ctx.db.insert('userBlocks', {
      blockerId,
      blockedId,
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
    const blockedId = await getValidatedPeerUserId(ctx, args.blockedId);

    const existing = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { ok: true };
  },
});

/**
 * Users the current account has blocked (for settings / management UI).
 * Sorted by display name. Omits hidden profiles but still returns blockedId so they can be unblocked.
 */
export const listMyBlockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const blockerId = await requireAuthUserId(ctx);
    const blocks = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', blockerId))
      .collect();

    const rows: BlockedUserListRow[] = [];

    for (const block of blocks) {
      const profile = await ctx.db
        .query('profiles')
        .withIndex('by_userId', (q) => q.eq('userId', block.blockedId))
        .unique();

      if (!profile) {
        rows.push({ blockedId: block.blockedId, name: 'Unknown user' });
        continue;
      }
      if (profile.isHidden) {
        rows.push({ blockedId: block.blockedId, name: 'Unavailable user' });
        continue;
      }
      rows.push({
        blockedId: block.blockedId,
        name: profile.name,
        major: profile.major,
      });
    }

    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return rows;
  },
});

/**
 * Check if the current user has blocked the given user.
 */
export const isBlocking = query({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const blockedId = await getValidatedPeerUserId(ctx, args.blockedId);
    const block = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
      )
      .first();
    return block !== null;
  },
});

/**
 * Check if the current user is blocked by the given user.
 */
export const isBlockedBy = query({
  args: { blockerId: v.string() },
  handler: async (ctx, args) => {
    const blockedId = await requireAuthUserId(ctx);
    const blockerId = await getValidatedPeerUserId(ctx, args.blockerId);
    const block = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
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

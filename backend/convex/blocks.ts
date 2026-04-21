import { v, ConvexError } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { requireAuthUserId } from './lib/authIdentity';

type BlockedUserListRow = {
  blockedId: string;
  name: string;
  major?: string;
};

/** True if any block exists between the two users (either direction). */
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

async function resolvePeerUserId(
  ctx: { db: QueryCtx['db'] },
  peerUserId: string
): Promise<string | null> {
  const normalizedPeerUserId = await ctx.db.normalizeId('users', peerUserId);
  if (!normalizedPeerUserId) {
    return null;
  }

  const peerUser = await ctx.db.get(normalizedPeerUserId);
  if (!peerUser) {
    return null;
  }

  return normalizedPeerUserId as string;
}

/** Returns null if the target user id is missing or deleted (no-op). */
export const blockUser = mutation({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const blockedId = await resolvePeerUserId(ctx, args.blockedId);
    if (!blockedId) {
      return null;
    }

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

/** No-op if the target user id is missing or deleted. */
export const unblockUser = mutation({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const blockedId = await resolvePeerUserId(ctx, args.blockedId);
    if (!blockedId) {
      return { ok: true };
    }

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

/** Blocked users for the current account, sorted by name; hidden profiles shown as "Unavailable user". */
export const listMyBlockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const blockerId = await requireAuthUserId(ctx);
    const blocks = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) => q.eq('blockerId', blockerId))
      .collect();

    const blockedIds = [...new Set(blocks.map((b) => b.blockedId))];
    const profileEntries = await Promise.all(
      blockedIds.map(async (blockedId) => {
        const profile = await ctx.db
          .query('profiles')
          .withIndex('by_userId', (q) => q.eq('userId', blockedId))
          .first();
        return [blockedId, profile] as const;
      })
    );
    const profileByBlockedId = new Map(profileEntries);

    const rows: BlockedUserListRow[] = [];
    for (const block of blocks) {
      const profile = profileByBlockedId.get(block.blockedId);

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

/** False if the target user id is missing or deleted. */
export const isBlocking = query({
  args: { blockedId: v.string() },
  handler: async (ctx, args) => {
    const blockerId = await requireAuthUserId(ctx);
    const blockedId = await resolvePeerUserId(ctx, args.blockedId);
    if (!blockedId) return false;
    const block = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
      )
      .first();
    return block !== null;
  },
});

/** False if the blocker id is missing or deleted. */
export const isBlockedBy = query({
  args: { blockerId: v.string() },
  handler: async (ctx, args) => {
    const blockedId = await requireAuthUserId(ctx);
    const blockerId = await resolvePeerUserId(ctx, args.blockerId);
    if (!blockerId) return false;
    const block = await ctx.db
      .query('userBlocks')
      .withIndex('by_blocker_blocked', (q) =>
        q.eq('blockerId', blockerId).eq('blockedId', blockedId)
      )
      .first();
    return block !== null;
  },
});

/** Used by messaging. */
export const internalHasBlockBetween = internalQuery({
  args: {
    userIdA: v.string(),
    userIdB: v.string(),
  },
  handler: async (ctx, args) => {
    return await hasBlockBetween(ctx, args.userIdA, args.userIdB);
  },
});

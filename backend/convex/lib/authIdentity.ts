import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Convex Id<'users'> is a branded string — at runtime it equals the document _id string.
 * It is safe to store in v.string() fields and compare with string values from the DB.
 */

/**
 * Returns the stable Convex auth user ID for the current authenticated user.
 * Throws ConvexError if not authenticated.
 * Use this for all ownership checks, profile lookups, and user-scoped data.
 * @param message - Optional custom error message when not authenticated
 */
export async function requireAuthUserId(
  ctx: AuthCtx,
  message = 'Not authenticated'
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(message);
  }
  return userId;
}

/**
 * Returns the stable Convex auth user ID or null if not authenticated.
 */
export async function getStableUserId(ctx: AuthCtx): Promise<Id<'users'> | null> {
  return await getAuthUserId(ctx);
}

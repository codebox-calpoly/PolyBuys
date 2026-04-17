/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from '../_generated/api';
import { createConvexTest, createTestUser } from './testUtils';

describe('Blocks mutations', () => {
  it('blockUser returns null when the target user has been deleted', async () => {
    const t = createConvexTest();

    const blocker = await createTestUser(t, 'blocker@calpoly.edu', 'Blocker');
    const blocked = await createTestUser(t, 'blocked@calpoly.edu', 'Blocked');

    await t.run(async (ctx: any) => {
      await ctx.db.delete(blocked.id);
    });

    const asBlocker = t.withIdentity(blocker.identity);
    const result = await asBlocker.mutation(api.blocks.blockUser, {
      blockedId: blocked.id,
    });

    expect(result).toBeNull();

    const blocks = await t.run(async (ctx: any) => {
      return await ctx.db.query('userBlocks').collect();
    });

    expect(blocks).toHaveLength(0);
  });
});

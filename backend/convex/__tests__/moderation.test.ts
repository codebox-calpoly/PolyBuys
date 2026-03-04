/* eslint-disable @typescript-eslint/no-explicit-any */

import { internal } from '../_generated/api';
import { createConvexTest, createTestListing, createTestUser } from './testUtils';

describe('Moderation shadow queue', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalOpenAiKey) {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('enqueueShadowModeration inserts queue row and provider alert', async () => {
    const t = createConvexTest();
    const seller = await createTestUser(t, 'seller@calpoly.edu', 'Seller');
    const listingId = await createTestListing(t, seller.id);

    const result = await t.mutation(internal.moderation.enqueueShadowModeration, {
      contentType: 'listing',
      contentId: listingId,
      userId: seller.id,
      reason: 'missing_api_key',
    });

    expect(result.enqueued).toBe(true);

    const queueRow = await t.run(async (ctx: any) => {
      return await ctx.db.get(result.queueId);
    });
    expect(queueRow).toMatchObject({
      contentType: 'listing',
      contentId: listingId,
      userId: seller.id,
      status: 'pending',
      reason: 'missing_api_key',
      attemptCount: 0,
    });

    const alerts = await t.run(async (ctx: any) => {
      return await ctx.db
        .query('moderationAlerts')
        .withIndex('by_type_createdAt', (q: any) => q.eq('alertType', 'provider_degraded'))
        .take(10);
    });
    expect(alerts.some((alert: any) => alert.contentId === listingId)).toBe(true);
  });

  it('enqueueShadowModeration deduplicates pending items for the same content', async () => {
    const t = createConvexTest();
    const seller = await createTestUser(t, 'seller2@calpoly.edu', 'Seller Two');
    const listingId = await createTestListing(t, seller.id);

    const first = await t.mutation(internal.moderation.enqueueShadowModeration, {
      contentType: 'listing',
      contentId: listingId,
      userId: seller.id,
      reason: 'http_500',
    });
    const second = await t.mutation(internal.moderation.enqueueShadowModeration, {
      contentType: 'listing',
      contentId: listingId,
      userId: seller.id,
      reason: 'http_500',
    });

    expect(first.enqueued).toBe(true);
    expect(second.enqueued).toBe(false);
    expect(second.queueId).toBe(first.queueId);
  });

  it('applyShadowModerationResult hides flagged listings and marks queue row flagged', async () => {
    const t = createConvexTest();
    const seller = await createTestUser(t, 'seller3@calpoly.edu', 'Seller Three');
    const listingId = await createTestListing(t, seller.id);

    const now = Date.now();
    const queueId = await t.run(async (ctx: any) => {
      return await ctx.db.insert('shadowModerationQueue', {
        contentType: 'listing',
        contentId: listingId,
        userId: seller.id,
        reason: 'http_503',
        status: 'processing',
        attemptCount: 1,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
        processingStartedAt: now,
      });
    });

    const applied = await t.mutation(internal.moderation.applyShadowModerationResult, {
      queueId,
      flagged: true,
      categories: JSON.stringify({ harassment: true }),
      inputTextHash: 'abc123',
      inputTextPreview: 'preview',
    });

    expect(applied.applied).toBe(true);
    expect(applied.state).toBe('flagged');

    const listingAfter = await t.run(async (ctx: any) => {
      return await ctx.db.get(listingId);
    });
    expect(listingAfter?.isHidden).toBe(true);
    expect(listingAfter?.hiddenReason).toBe('shadow_moderation');

    const queueAfter = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueId);
    });
    expect(queueAfter?.status).toBe('flagged');

    const moderationRows = await t.run(async (ctx: any) => {
      return await ctx.db
        .query('moderationResults')
        .withIndex('by_contentType', (q: any) => q.eq('contentType', 'listing'))
        .take(20);
    });
    expect(
      moderationRows.some(
        (row: any) =>
          row.contentId === listingId && row.flagged === true && row.inputTextHash === 'abc123'
      )
    ).toBe(true);
  });

  it('requeues stale processing rows so they do not stay stuck forever', async () => {
    const t = createConvexTest();
    const seller = await createTestUser(t, 'seller4@calpoly.edu', 'Seller Four');
    const listingId = await createTestListing(t, seller.id);

    const now = Date.now();
    const queueId = await t.run(async (ctx: any) => {
      return await ctx.db.insert('shadowModerationQueue', {
        contentType: 'listing',
        contentId: listingId,
        userId: seller.id,
        reason: 'provider_timeout',
        status: 'processing',
        attemptCount: 1,
        nextAttemptAt: now - 10_000,
        createdAt: now - 10_000,
        updatedAt: now - 10_000,
        processingStartedAt: now - 10 * 60 * 1000,
      });
    });

    const result = await t.mutation(internal.moderation.requeueStaleShadowModerationItems, {
      limit: 10,
    });
    expect(result.requeued).toBeGreaterThanOrEqual(1);

    const queueRow = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueId);
    });
    expect(queueRow).toMatchObject({
      status: 'pending',
      lastError: 'processing_timeout',
    });
    expect(queueRow?.processingStartedAt).toBeUndefined();
  });
});

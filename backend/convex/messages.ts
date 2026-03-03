import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 100;
const MAX_READ_PATCH_BATCH = 1000;
const UNREAD_CAP = 99;
const MESSAGE_MIN_INTERVAL_MS = 1_000;
const MAX_CONVERSATION_DUPLICATE_SCAN = 25;
const CURSOR_WINDOW_FETCH_MULTIPLIER = 4;
const CURSOR_WINDOW_FETCH_PADDING = 20;
const MAX_CURSOR_WINDOW_FETCH = 5000;

function buildConversationKey(listingId: Id<'listings'>, buyerId: string, sellerId: string) {
  return [String(listingId), buyerId, sellerId].map(encodeURIComponent).join('|');
}

type MessageCursor = {
  createdAt: number;
  id: string;
};

type ConversationCursor = {
  updatedAt: number;
  id: string;
};

function encodeMessageCursor(createdAt: number, id: string) {
  return `${createdAt}|${id}`;
}

function parseMessageCursor(cursor: string | undefined): MessageCursor | null {
  if (!cursor) {
    return null;
  }
  const sep = cursor.indexOf('|');
  if (sep === -1) {
    throw new ConvexError('Invalid cursor');
  }
  const createdAt = Number.parseInt(cursor.slice(0, sep), 10);
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(createdAt) || createdAt <= 0 || id.length === 0) {
    throw new ConvexError('Invalid cursor');
  }
  return { createdAt, id };
}

function isLegacyCompoundCursor(cursor: string | undefined) {
  if (!cursor) {
    return false;
  }
  const sep = cursor.indexOf('|');
  if (sep <= 0) {
    return false;
  }
  return /^[0-9]+$/.test(cursor.slice(0, sep));
}

function parseConversationCursor(cursor: string | undefined): ConversationCursor | null {
  if (!cursor) {
    return null;
  }
  const sep = cursor.indexOf('|');
  if (sep === -1) {
    throw new ConvexError('Invalid cursor');
  }
  const updatedAt = Number.parseInt(cursor.slice(0, sep), 10);
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(updatedAt) || updatedAt <= 0 || id.length === 0) {
    throw new ConvexError('Invalid cursor');
  }
  return { updatedAt, id };
}

async function runMessagingBackfillBatch(
  ctx: MutationCtx,
  args: {
    convoCursor?: string;
    messageCursor?: string;
    batchSize: number;
  }
) {
  const convoPage = await ctx.db.query('conversations').paginate({
    cursor: args.convoCursor ?? null,
    numItems: args.batchSize,
  });

  let conversationPatches = 0;
  for (const convo of convoPage.page) {
    const expectedConversationKey = buildConversationKey(
      convo.listingId,
      convo.buyerId,
      convo.sellerId
    );
    const needsParticipantPatch = !convo.participantIds || convo.participantIds.length !== 2;
    const needsConversationKeyPatch = convo.conversationKey !== expectedConversationKey;
    if (needsParticipantPatch || needsConversationKeyPatch) {
      await ctx.db.patch(convo._id, {
        participantIds: [convo.buyerId, convo.sellerId],
        conversationKey: expectedConversationKey,
      });
      conversationPatches += 1;
    }
  }

  const messagePage = await ctx.db.query('messages').paginate({
    cursor: args.messageCursor ?? null,
    numItems: args.batchSize,
  });

  let messagePatches = 0;
  for (const message of messagePage.page) {
    if (!message.type) {
      await ctx.db.patch(message._id, { type: 'text' });
      messagePatches += 1;
    }
  }

  return {
    conversationPatches,
    messagePatches,
    nextConvoCursor: convoPage.isDone ? null : convoPage.continueCursor,
    nextMessageCursor: messagePage.isDone ? null : messagePage.continueCursor,
    done: convoPage.isDone && messagePage.isDone,
  };
}

// Internal query: get conversation and verify user is a participant (used by sendMessage action)
export const internalGetConversation = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

export const internalGetLatestConversationMessage = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query('messages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(1);
    return latest[0] ?? null;
  },
});

// Internal mutation: persists a message and updates conversation (called by sendMessage action after moderation)
export const internalSendMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    senderId: v.string(),
    recipientId: v.string(),
    body: v.string(),
    type: v.union(v.literal('text'), v.literal('system')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      listingId: args.listingId,
      senderId: args.senderId,
      recipientId: args.recipientId,
      body: args.body,
      createdAt: now,
      readAt: 0,
      type: args.type,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageId: messageId,
    });

    return { messageId };
  },
});

// Sends a message (action — screens content via moderation before persisting)
// Note: `type` is intentionally omitted from public args. The client path is
// locked to 'text'. Only internalSendMessage may write the 'system' type.
export const sendMessage = action({
  args: {
    conversationId: v.id('conversations'),
    body: v.string(),
  },
  handler: async (ctx, args): Promise<{ messageId: string }> => {
    // Validate message body length
    const trimmedBody = args.body.trim();
    if (trimmedBody.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (trimmedBody.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
      throw new ConvexError(`Message must be ${PAYLOAD_BOUNDS.MESSAGE_MAX} characters or less`);
    }

    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Unauthorized');
    }
    const userId = identity.subject;

    // Participant check via internal query
    const convo = await ctx.runQuery(internal.messages.internalGetConversation, {
      conversationId: args.conversationId,
    });
    if (!convo) {
      throw new ConvexError('Conversation not found');
    }

    const isBuyer = convo.buyerId === userId;
    const isSeller = convo.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ConvexError('Forbidden');
    }

    const recipientId = userId === convo.buyerId ? convo.sellerId : convo.buyerId;
    const latestMessage = await ctx.runQuery(
      internal.messages.internalGetLatestConversationMessage,
      {
        conversationId: args.conversationId,
      }
    );
    const now = Date.now();
    if (
      latestMessage &&
      latestMessage.senderId === userId &&
      now - latestMessage.createdAt < MESSAGE_MIN_INTERVAL_MS
    ) {
      throw new ConvexError('You are sending messages too quickly. Please wait a moment.');
    }

    // Screen content via OpenAI Moderation API
    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: trimmedBody,
      contentType: 'message',
      userId,
    });

    if (moderationResult.flagged) {
      throw new ConvexError('Your message was not sent because it contains inappropriate content.');
    }

    // Persist via internal mutation
    const result = await ctx.runMutation(internal.messages.internalSendMessage, {
      conversationId: args.conversationId,
      listingId: convo.listingId,
      senderId: userId,
      recipientId,
      body: trimmedBody,
      type: 'text',
    });

    if (moderationResult.degraded) {
      try {
        await ctx.runMutation(internal.moderation.enqueueShadowModeration, {
          contentType: 'message',
          contentId: result.messageId,
          userId,
          reason: moderationResult.degradeReason ?? 'provider_degraded',
        });
      } catch (error) {
        // Keep messaging fail-open even if queueing fails.
        console.warn('[moderation] unable to enqueue shadow moderation for message:', error);
      }
    }

    return result;
  },
});

// List user conversations with pagination + inbox payload.
//
// CURSOR FORMAT: "{updatedAt}|{_id}"
// Uses a compound cursor to preserve stable ordering when multiple conversations
// share the same updatedAt ms timestamp.
// - Index queries use `lte('updatedAt', cursorTs)` (inclusive boundary) so ties
//   are never dropped.
// - After dedup+sort, rows from the previous page are filtered out by
//   (updatedAt === cursorTs && _id <= cursorId), using Convex ID lexicographic order.
// - Adaptive overfetch expands query windows under same-timestamp bursts to reduce
//   skip risk while keeping a hard cap to avoid unbounded scans.
//
// FAN-OUT: all per-page I/O (profiles, previews, unread counts) is fired in a
// single Promise.all to eliminate sequential round trips.
export const listUserConversations = query({
  args: {
    limit: v.optional(v.number()),
    // Opaque compound cursor: "{updatedAt}|{_id}". Absent = first page.
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 20, 50));

    const parsedCursor = parseConversationCursor(args.cursor);
    const hasValidCursor = parsedCursor !== null;
    const cursorTs = parsedCursor?.updatedAt ?? 0;
    const cursorId = parsedCursor?.id ?? '';

    let fetchSize = Math.min(
      MAX_CURSOR_WINDOW_FETCH,
      limit * CURSOR_WINDOW_FETCH_MULTIPLIER + CURSOR_WINDOW_FETCH_PADDING
    );
    let sorted: Doc<'conversations'>[] = [];

    for (;;) {
      const [buyerConvos, sellerConvos] = await Promise.all([
        hasValidCursor
          ? ctx.db
              .query('conversations')
              .withIndex('by_buyer', (q) => q.eq('buyerId', userId).lte('updatedAt', cursorTs))
              .order('desc')
              .take(fetchSize)
          : ctx.db
              .query('conversations')
              .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
              .order('desc')
              .take(fetchSize),
        hasValidCursor
          ? ctx.db
              .query('conversations')
              .withIndex('by_seller', (q) => q.eq('sellerId', userId).lte('updatedAt', cursorTs))
              .order('desc')
              .take(fetchSize)
          : ctx.db
              .query('conversations')
              .withIndex('by_seller', (q) => q.eq('sellerId', userId))
              .order('desc')
              .take(fetchSize),
      ]);

      // Deduplicate (user can be buyer and seller simultaneously) and sort desc
      const deduped = new Map([...buyerConvos, ...sellerConvos].map((c) => [c._id, c]));
      sorted = [...deduped.values()].sort(
        (a, b) => b.updatedAt - a.updatedAt || (a._id < b._id ? 1 : -1)
      );

      // Drop rows already delivered on the previous page (same-ts tiebreaker)
      if (hasValidCursor) {
        sorted = sorted.filter(
          (c) => c.updatedAt < cursorTs || (c.updatedAt === cursorTs && c._id < cursorId)
        );
      }

      const hasEnoughForPage = sorted.length > limit;
      const buyerExhausted = buyerConvos.length < fetchSize;
      const sellerExhausted = sellerConvos.length < fetchSize;
      const reachedFetchCap = fetchSize >= MAX_CURSOR_WINDOW_FETCH;

      if (hasEnoughForPage || (buyerExhausted && sellerExhausted) || reachedFetchCap) {
        break;
      }

      fetchSize = Math.min(MAX_CURSOR_WINDOW_FETCH, fetchSize * 2);
    }

    const page = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;

    // ── Batch all per-page I/O in parallel ──────────────────────────────────
    // 1. Unique counterpart user IDs for profile lookups
    const otherUserIds = [
      ...new Set(page.map((c) => (c.buyerId === userId ? c.sellerId : c.buyerId))),
    ];

    // Fire profiles, previews and unread counts simultaneously
    const [profileResults, previewResults, unreadResults] = await Promise.all([
      // Profiles: one lookup per unique counterpart
      Promise.all(
        otherUserIds.map((uid) =>
          ctx.db
            .query('profiles')
            .withIndex('by_userId', (q) => q.eq('userId', uid))
            .unique()
        )
      ),
      // Previews: one ctx.db.get per convo (lastMessageId already cached on conversations)
      Promise.all(
        page.map((convo) => (convo.lastMessageId ? ctx.db.get(convo.lastMessageId) : null))
      ),
      // Unread counts: one index range per convo (bounded by UNREAD_CAP+1)
      Promise.all(
        page.map((convo) =>
          ctx.db
            .query('messages')
            .withIndex('by_conversation_recipient_readAt', (q) =>
              q.eq('conversationId', convo._id).eq('recipientId', userId).eq('readAt', 0)
            )
            .take(UNREAD_CAP + 1)
        )
      ),
    ]);

    // Build profile map from parallel results
    const profileMap = new Map<string, { name: string | null; avatarStorageId: string | null }>();
    otherUserIds.forEach((uid, i) => {
      const p = profileResults[i];
      profileMap.set(uid, { name: p?.name ?? null, avatarStorageId: p?.picture ?? null });
    });

    // Assemble items
    const items = page.map((convo, i) => {
      const otherUserId = convo.buyerId === userId ? convo.sellerId : convo.buyerId;
      const preview = (previewResults[i]?.body ?? '').slice(0, 140);
      const unreadRows = unreadResults[i];
      const prof = profileMap.get(otherUserId);
      return {
        conversationId: convo._id,
        listingId: convo.listingId,
        lastMessageAt: convo.updatedAt,
        lastMessagePreview: preview,
        unreadCount: Math.min(unreadRows.length, UNREAD_CAP),
        unreadCapped: unreadRows.length > UNREAD_CAP,
        otherParticipant: {
          id: otherUserId,
          name: prof?.name ?? null,
          avatarStorageId: prof?.avatarStorageId ?? null,
        },
      };
    });

    // Encode compound cursor from the last item on this page
    const last = page.length > 0 ? page[page.length - 1] : null;
    const nextCursor = hasMore && last ? `${last.updatedAt}|${last._id}` : null;

    return { items, nextCursor };
  },
});

async function getUserId(ctx: MutationCtx | QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Unauthorized');
  return identity.subject;
}

async function requireParticipant(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>
) {
  const userId = await getUserId(ctx);
  const convo = await ctx.db.get(conversationId);
  if (!convo) throw new ConvexError('Conversation not found');

  const isBuyer = convo.buyerId === userId;
  const isSeller = convo.sellerId === userId;
  if (!isBuyer && !isSeller) throw new ConvexError('Forbidden');

  return { userId, convo, isBuyer, isSeller };
}

async function reconcileConversationDuplicates(
  ctx: MutationCtx,
  args: {
    listingId: Id<'listings'>;
    buyerId: string;
    sellerId: string;
    conversationKey: string;
  }
): Promise<Id<'conversations'> | null> {
  const [byConversationKey, byTuple] = await Promise.all([
    ctx.db
      .query('conversations')
      .withIndex('by_conversation_key', (q) => q.eq('conversationKey', args.conversationKey))
      .take(MAX_CONVERSATION_DUPLICATE_SCAN),
    ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', args.buyerId).eq('sellerId', args.sellerId)
      )
      .take(MAX_CONVERSATION_DUPLICATE_SCAN),
  ]);

  const matches = [
    ...new Map([...byConversationKey, ...byTuple].map((row) => [row._id, row])).values(),
  ];

  if (matches.length === 0) {
    return null;
  }

  // Pick a deterministic canonical conversation: oldest createdAt, then lowest ID.
  const sorted = [...matches].sort((a, b) => a.createdAt - b.createdAt || (a._id < b._id ? -1 : 1));
  const canonical = sorted[0];

  if (
    !canonical.participantIds ||
    canonical.participantIds.length !== 2 ||
    canonical.conversationKey !== args.conversationKey
  ) {
    await ctx.db.patch(canonical._id, {
      participantIds: [args.buyerId, args.sellerId],
      conversationKey: args.conversationKey,
    });
  }

  for (const duplicate of sorted.slice(1)) {
    if (duplicate.lastMessageId) {
      continue;
    }

    const hasMessages =
      (
        await ctx.db
          .query('messages')
          .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', duplicate._id))
          .take(1)
      ).length > 0;

    if (hasMessages) {
      continue;
    }

    try {
      await ctx.db.delete(duplicate._id);
    } catch {
      // Best effort cleanup under concurrent dedupe calls.
    }
  }

  return canonical._id;
}

export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerId = await getUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new ConvexError('Listing not found');

    // Security: Only allow conversations on active, public listings
    if (listing.status !== 'active') {
      throw new ConvexError('Listing is not active');
    }
    if (listing.isHidden) {
      throw new ConvexError('Listing is not available');
    }

    const sellerId = listing.sellerId;
    if (buyerId === sellerId) throw new ConvexError("You can't message yourself");
    const conversationKey = buildConversationKey(args.listingId, buyerId, sellerId);

    const canonicalBeforeInsert = await reconcileConversationDuplicates(ctx, {
      listingId: args.listingId,
      buyerId,
      sellerId,
      conversationKey,
    });
    if (canonicalBeforeInsert) {
      return { conversationId: canonicalBeforeInsert };
    }

    const now = Date.now();
    const insertedConversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId,
      sellerId,
      conversationKey,
      participantIds: [buyerId, sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });

    const canonicalAfterInsert = await reconcileConversationDuplicates(ctx, {
      listingId: args.listingId,
      buyerId,
      sellerId,
      conversationKey,
    });

    return { conversationId: canonicalAfterInsert ?? insertedConversationId };
  },
});

export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const { userId, convo, isBuyer, isSeller } = await requireParticipant(ctx, args.conversationId);

    const now = Date.now();

    if (isBuyer) {
      await ctx.db.patch(convo._id, { buyerLastReadAt: now });
    } else if (isSeller) {
      await ctx.db.patch(convo._id, { sellerLastReadAt: now });
    }

    // Drain all unread messages in batches until none remain.
    // Re-querying after each batch is correct because patching readAt to `now` (non-zero)
    // removes those rows from the readAt=0 filter, so each iteration scans fresh rows.
    // Common case (<1000 unread) finishes in one pass; heavy inboxes drain across passes.
    let patched = 0;
    for (;;) {
      const batch = await ctx.db
        .query('messages')
        .withIndex('by_conversation_recipient_readAt', (q) =>
          q.eq('conversationId', args.conversationId).eq('recipientId', userId).eq('readAt', 0)
        )
        .take(MAX_READ_PATCH_BATCH);
      if (batch.length === 0) break;
      for (const msg of batch) {
        await ctx.db.patch(msg._id, { readAt: now });
      }
      patched += batch.length;
      if (batch.length < MAX_READ_PATCH_BATCH) break; // fewer than full batch — done
    }

    return { ok: true, patched };
  },
});

export const backfillMessagingFields = internalMutation({
  args: {
    convoCursor: v.optional(v.string()),
    messageCursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 200, 500));
    return await runMessagingBackfillBatch(ctx, {
      convoCursor: args.convoCursor,
      messageCursor: args.messageCursor,
      batchSize,
    });
  },
});

// Orchestrated backfill: schedules batched runs of backfillMessagingFields until
// the entire conversations and messages table has been processed.
// Invoke once via the Convex dashboard or CLI:
//   npx convex run messages:startBackfill
export const startBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.messages.driveBackfill, {});
    return { scheduled: true };
  },
});

export const driveBackfill = internalMutation({
  args: {
    convoCursor: v.optional(v.string()),
    messageCursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await runMessagingBackfillBatch(ctx, {
      convoCursor: args.convoCursor,
      messageCursor: args.messageCursor,
      batchSize: 200,
    });
    if (!result.done) {
      await ctx.scheduler.runAfter(0, internal.messages.driveBackfill, {
        convoCursor: result.nextConvoCursor ?? undefined,
        messageCursor: result.nextMessageCursor ?? undefined,
      });
    }
    return { done: result.done };
  },
});

export const messagesByConversationPaginated = query({
  args: {
    conversationId: v.id('conversations'),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.conversationId);

    const limit = Math.max(
      1,
      Math.min(args.limit ?? DEFAULT_MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGE_SIZE)
    );
    const rawCursor = args.cursor;
    const useLegacyCursor = isLegacyCompoundCursor(rawCursor);

    if (!useLegacyCursor) {
      const makeMessagesQuery = () =>
        ctx.db
          .query('messages')
          .withIndex('by_conversation_createdAt', (q) =>
            q.eq('conversationId', args.conversationId)
          )
          .order('desc');
      let page;
      try {
        page = await makeMessagesQuery().paginate({
          numItems: limit,
          cursor: rawCursor ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (rawCursor !== undefined && /cursor/i.test(message)) {
          throw new ConvexError('Invalid cursor');
        }
        throw error;
      }

      let nextCursor: string | null = null;
      if (!page.isDone) {
        if (page.page.length < limit) {
          nextCursor = null;
        } else {
          const probePage = await makeMessagesQuery().paginate({
            numItems: 1,
            cursor: page.continueCursor,
          });
          nextCursor = probePage.page.length === 0 ? null : page.continueCursor;
        }
      }

      return {
        items: page.page.reverse(),
        nextCursor,
      };
    }

    const parsedCursor = parseMessageCursor(rawCursor);
    let fetchSize = Math.min(
      MAX_CURSOR_WINDOW_FETCH,
      limit * CURSOR_WINDOW_FETCH_MULTIPLIER + CURSOR_WINDOW_FETCH_PADDING
    );
    let sorted: Doc<'messages'>[] = [];

    for (;;) {
      const rows = await ctx.db
        .query('messages')
        .withIndex('by_conversation_createdAt', (q) =>
          q.eq('conversationId', args.conversationId).lte('createdAt', parsedCursor!.createdAt)
        )
        .order('desc')
        .take(fetchSize);

      sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt || (a._id < b._id ? 1 : -1));
      sorted = sorted.filter(
        (m) =>
          m.createdAt < parsedCursor!.createdAt ||
          (m.createdAt === parsedCursor!.createdAt && m._id < parsedCursor!.id)
      );

      const hasEnoughForPage = sorted.length > limit;
      const exhausted = rows.length < fetchSize;
      const reachedFetchCap = fetchSize >= MAX_CURSOR_WINDOW_FETCH;
      if (hasEnoughForPage || exhausted || reachedFetchCap) {
        break;
      }

      fetchSize = Math.min(MAX_CURSOR_WINDOW_FETCH, fetchSize * 2);
    }

    const pageDesc = sorted.slice(0, limit);
    const hasMore = sorted.length > limit;
    const nextCursor =
      hasMore && pageDesc.length > 0
        ? encodeMessageCursor(
            pageDesc[pageDesc.length - 1].createdAt,
            pageDesc[pageDesc.length - 1]._id
          )
        : null;

    return {
      items: pageDesc.reverse(),
      nextCursor,
    };
  },
});

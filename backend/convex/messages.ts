import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

const MAX_CONVERSATION_HISTORY = 500;
const MAX_READ_PATCH_BATCH = 1000;
const UNREAD_CAP = 99;

// Internal query: get conversation and verify user is a participant (used by sendMessage action)
export const internalGetConversation = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
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
    if (args.body.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (args.body.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
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

    // Screen content via OpenAI Moderation API
    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: args.body,
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
      body: args.body,
      type: 'text',
    });

    return result;
  },
});

//Retrieve all messages for a conversation with conversationID in chronological order
export const getConversationHistory = query({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.conversationId);

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', args.conversationId))
      .take(MAX_CONVERSATION_HISTORY);

    return messages;
  },
});

// List user conversations with pagination + inbox payload.
//
// CURSOR FORMAT: "{updatedAt}|{_id}"
// Using a compound cursor avoids the skip/duplicate problem when multiple
// conversations share the same updatedAt ms timestamp.
// - Index queries use `lte('updatedAt', cursorTs)` (inclusive boundary) so ties
//   are never dropped.
// - After dedup+sort, rows from the previous page are filtered out by
//   (updatedAt === cursorTs && _id <= cursorId), using Convex ID lexicographic order.
// Both by_buyer and by_seller indexes include updatedAt, so the range is index-native
// and every conversation is reachable regardless of collection size.
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

    // Parse compound cursor
    let cursorTs = NaN;
    let cursorId = '';
    if (args.cursor) {
      const sep = args.cursor.indexOf('|');
      if (sep !== -1) {
        cursorTs = Number.parseInt(args.cursor.slice(0, sep), 10);
        cursorId = args.cursor.slice(sep + 1);
      }
    }
    const hasValidCursor = !Number.isNaN(cursorTs) && cursorTs > 0 && cursorId !== '';

    // Overfetch per side to survive dedup and still fill a full page.
    // lte boundary may pull extra same-ts rows that get filtered below.
    const FETCH = limit * 4 + 20;

    const [buyerConvos, sellerConvos] = await Promise.all([
      hasValidCursor
        ? ctx.db
            .query('conversations')
            .withIndex('by_buyer', (q) => q.eq('buyerId', userId).lte('updatedAt', cursorTs))
            .order('desc')
            .take(FETCH)
        : ctx.db
            .query('conversations')
            .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
            .order('desc')
            .take(FETCH),
      hasValidCursor
        ? ctx.db
            .query('conversations')
            .withIndex('by_seller', (q) => q.eq('sellerId', userId).lte('updatedAt', cursorTs))
            .order('desc')
            .take(FETCH)
        : ctx.db
            .query('conversations')
            .withIndex('by_seller', (q) => q.eq('sellerId', userId))
            .order('desc')
            .take(FETCH),
    ]);

    // Deduplicate (user can be buyer and seller simultaneously) and sort desc
    const deduped = new Map([...buyerConvos, ...sellerConvos].map((c) => [c._id, c]));
    let sorted = [...deduped.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt || (a._id < b._id ? 1 : -1)
    );

    // Drop rows already delivered on the previous page (same-ts tiebreaker)
    if (hasValidCursor) {
      sorted = sorted.filter(
        (c) => c.updatedAt < cursorTs || (c.updatedAt === cursorTs && c._id < cursorId)
      );
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
    const profileMap = new Map<string, { name: string | null; avatar: string | null }>();
    otherUserIds.forEach((uid, i) => {
      const p = profileResults[i];
      profileMap.set(uid, { name: p?.name ?? null, avatar: p?.picture ?? null });
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
          avatar: prof?.avatar ?? null,
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

    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', buyerId)
      )
      .filter((q) => q.eq(q.field('sellerId'), sellerId))
      .first();

    if (existing) return { conversationId: existing._id };

    const now = Date.now();
    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId,
      sellerId,
      participantIds: [buyerId, sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
    });

    return { conversationId };
  },
});

// TASK: mark messages as read functionality
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const { userId, convo, isBuyer, isSeller } = await requireParticipant(ctx, args.conversationId);

    const now = Date.now();

    if (isBuyer) {
      await ctx.db.patch(convo._id, { buyerLastReadAt: now, updatedAt: now });
    } else if (isSeller) {
      await ctx.db.patch(convo._id, { sellerLastReadAt: now, updatedAt: now });
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

// TASK: real-time message delivery (Convex query is reactive when used with useQuery)
export const backfillMessagingFields = internalMutation({
  args: {
    convoCursor: v.optional(v.string()),
    messageCursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 200, 500));

    const convoPage = await ctx.db.query('conversations').paginate({
      cursor: args.convoCursor ?? null,
      numItems: batchSize,
    });

    let conversationPatches = 0;
    for (const convo of convoPage.page) {
      if (!convo.participantIds || convo.participantIds.length !== 2) {
        await ctx.db.patch(convo._id, { participantIds: [convo.buyerId, convo.sellerId] });
        conversationPatches += 1;
      }
    }

    const messagePage = await ctx.db.query('messages').paginate({
      cursor: args.messageCursor ?? null,
      numItems: batchSize,
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
    const batchSize = 200;

    const convoPage = await ctx.db.query('conversations').paginate({
      cursor: args.convoCursor ?? null,
      numItems: batchSize,
    });
    for (const convo of convoPage.page) {
      if (!convo.participantIds || convo.participantIds.length !== 2) {
        await ctx.db.patch(convo._id, { participantIds: [convo.buyerId, convo.sellerId] });
      }
    }

    const messagePage = await ctx.db.query('messages').paginate({
      cursor: args.messageCursor ?? null,
      numItems: batchSize,
    });
    for (const message of messagePage.page) {
      if (!message.type) {
        await ctx.db.patch(message._id, { type: 'text' });
      }
    }

    const done = convoPage.isDone && messagePage.isDone;
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.messages.driveBackfill, {
        convoCursor: convoPage.isDone ? undefined : convoPage.continueCursor,
        messageCursor: messagePage.isDone ? undefined : messagePage.continueCursor,
      });
    }
    return { done };
  },
});

export const messagesByConversation = query({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    await requireParticipant(ctx, args.conversationId);

    return await ctx.db
      .query('messages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', args.conversationId))
      .take(MAX_CONVERSATION_HISTORY);
  },
});

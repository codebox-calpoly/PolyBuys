import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { hasBlockBetween } from './blocks';
import { requireAuthUserId } from './lib/authIdentity';
import { logError } from './lib/logger';
import { getReportedConversationListingIdSetByReporter } from './lib/reportedConversationListings';

export const PAYLOAD_BOUNDS = {
  MESSAGE_MAX: 2000,
};

const MAX_REPORTS_PER_DAY = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_NOTES_LENGTH = 500;
const DEFAULT_INBOX_LIMIT = 100;
const MAX_INBOX_LIMIT = 200;
const MAX_INBOX_SCAN_PER_ROLE = 400;
const DEFAULT_MESSAGE_HISTORY_LIMIT = 500;
const MAX_MESSAGE_HISTORY_LIMIT = 5000;
const MAX_MESSAGE_PAGE_SIZE = 100;
const DEFAULT_BACKFILL_BATCH_SIZE = 100;
const MAX_BACKFILL_BATCH_SIZE = 200;
const CONVERSATION_STARTED_PREVIEW = 'Conversation started';
type ConversationInboxHiddenReason = 'deleted' | 'reported';
type ReportReason = 'scam' | 'inappropriate' | 'spam' | 'other';
const REPORT_REASON_VALIDATOR = v.union(
  v.literal('scam'),
  v.literal('inappropriate'),
  v.literal('spam'),
  v.literal('other')
);

function shouldPreserveHiddenConversationState(
  hiddenAt: number | undefined,
  hiddenReason: ConversationInboxHiddenReason | undefined
) {
  return hiddenAt !== undefined && hiddenReason === 'reported';
}

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function displayNameFromProfile(profile: { name?: string } | null, user: { name?: string } | null) {
  const userName = user?.name?.trim();
  if (userName && userName.length > 0) {
    return userName;
  }

  const profileName = profile?.name?.trim();
  if (profileName && profileName.length > 0) {
    return profileName;
  }

  return 'User';
}

function normalizeQueryLimit(
  limit: number | undefined,
  defaultValue: number,
  maxValue: number,
  label: string
) {
  if (limit === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new ConvexError(`${label} must be a positive integer`);
  }

  return Math.min(limit, maxValue);
}

function getConversationViewerUnreadCount(
  conversation: Doc<'conversations'>,
  userId: string
): number | undefined {
  if (conversation.buyerId === userId) {
    return conversation.buyerUnreadCount;
  }

  if (conversation.sellerId === userId) {
    return conversation.sellerUnreadCount;
  }

  return undefined;
}

function getMessagePreview(body: string) {
  return body;
}

type MessagePageCursor = {
  createdAt: number;
  messageId: Id<'messages'>;
};

function compareMessagesDescending(left: Doc<'messages'>, right: Doc<'messages'>) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }

  return right._id.localeCompare(left._id);
}

function compareMessagesAscending(left: Doc<'messages'>, right: Doc<'messages'>) {
  return -compareMessagesDescending(left, right);
}

function encodeMessagePageCursor(message: Doc<'messages'>) {
  return JSON.stringify({
    createdAt: message.createdAt,
    messageId: message._id,
  } satisfies MessagePageCursor);
}

function decodeMessagePageCursor(cursor: string | null | undefined): MessagePageCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<MessagePageCursor>;
    if (
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.messageId !== 'string' ||
      parsed.messageId.length === 0
    ) {
      throw new Error('Invalid cursor shape');
    }

    return {
      createdAt: parsed.createdAt,
      messageId: parsed.messageId as Id<'messages'>,
    };
  } catch {
    throw new ConvexError('Invalid message pagination cursor');
  }
}

function isMessageStrictlyOlderThanCursor(message: Doc<'messages'>, cursor: MessagePageCursor) {
  if (message.createdAt !== cursor.createdAt) {
    return message.createdAt < cursor.createdAt;
  }

  return message._id < cursor.messageId;
}

function validatePaginatedBatchSize(numItems: number, label: string, maxValue: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > maxValue) {
    throw new ConvexError(`${label} numItems must be between 1 and ${maxValue}`);
  }
}

async function getUnreadMessageCount(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>,
  recipientId: string
) {
  const unreadMessages = await ctx.db
    .query('messages')
    .withIndex('by_conversation_recipient_readAt', (q) =>
      q.eq('conversationId', conversationId).eq('recipientId', recipientId).eq('readAt', 0)
    )
    .collect();

  return unreadMessages.length;
}

async function getLatestMessageForConversation(
  ctx: MutationCtx | QueryCtx,
  conversationId: Id<'conversations'>
) {
  return await ctx.db
    .query('messages')
    .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId))
    .order('desc')
    .first();
}

async function buildConversationMessageStatePatch(
  ctx: MutationCtx | QueryCtx,
  conversation: Doc<'conversations'>
): Promise<Partial<Doc<'conversations'>>> {
  const [latestMessage, buyerUnreadCount, sellerUnreadCount] = await Promise.all([
    getLatestMessageForConversation(ctx, conversation._id),
    getUnreadMessageCount(ctx, conversation._id, conversation.buyerId),
    getUnreadMessageCount(ctx, conversation._id, conversation.sellerId),
  ]);

  if (!latestMessage) {
    return {
      lastMessageId: undefined,
      lastMessagePreview: undefined,
      lastMessageAt: undefined,
      updatedAt: conversation.createdAt,
      buyerUnreadCount,
      sellerUnreadCount,
    };
  }

  return {
    lastMessageId: latestMessage._id,
    lastMessagePreview: getMessagePreview(latestMessage.body),
    lastMessageAt: latestMessage.createdAt,
    updatedAt: latestMessage.createdAt,
    buyerUnreadCount,
    sellerUnreadCount,
  };
}

function buildConversationStateDiff(
  conversation: Doc<'conversations'>,
  nextState: Partial<Doc<'conversations'>>
) {
  const patch: Partial<Doc<'conversations'>> = {};

  if (conversation.lastMessageId !== nextState.lastMessageId) {
    patch.lastMessageId = nextState.lastMessageId;
  }
  if (conversation.lastMessagePreview !== nextState.lastMessagePreview) {
    patch.lastMessagePreview = nextState.lastMessagePreview;
  }
  if (conversation.lastMessageAt !== nextState.lastMessageAt) {
    patch.lastMessageAt = nextState.lastMessageAt;
  }
  if (conversation.updatedAt !== nextState.updatedAt && nextState.updatedAt !== undefined) {
    patch.updatedAt = nextState.updatedAt;
  }
  if (conversation.buyerUnreadCount !== nextState.buyerUnreadCount) {
    patch.buyerUnreadCount = nextState.buyerUnreadCount;
  }
  if (conversation.sellerUnreadCount !== nextState.sellerUnreadCount) {
    patch.sellerUnreadCount = nextState.sellerUnreadCount;
  }

  return patch;
}

async function resolveConversationInboxState(
  ctx: QueryCtx,
  conversation: Doc<'conversations'>,
  userId: string
) {
  let latestMessage: Doc<'messages'> | null = null;

  if (!conversation.lastMessageId) {
    latestMessage = await getLatestMessageForConversation(ctx, conversation._id);
    if (!latestMessage) {
      return null;
    }
  } else if (
    conversation.lastMessagePreview === undefined ||
    conversation.lastMessageAt === undefined
  ) {
    latestMessage = await ctx.db.get(conversation.lastMessageId);
    if (!latestMessage) {
      latestMessage = await getLatestMessageForConversation(ctx, conversation._id);
      if (!latestMessage) {
        return null;
      }
    }
  }

  const storedUnreadCount = getConversationViewerUnreadCount(conversation, userId);
  const unreadCount =
    storedUnreadCount ?? (await getUnreadMessageCount(ctx, conversation._id, userId));
  const lastMessagePreview =
    conversation.lastMessagePreview ?? latestMessage?.body ?? CONVERSATION_STARTED_PREVIEW;
  const lastMessageAt =
    conversation.lastMessageAt ?? latestMessage?.createdAt ?? conversation.updatedAt;

  return {
    lastMessagePreview,
    lastMessageAt,
    unreadCount,
    effectiveUpdatedAt: lastMessageAt,
  };
}

/** Returns the stable auth user ID. Throws if not authenticated. */
async function requireStableUserId(
  ctx: MutationCtx | QueryCtx,
  message = 'Unauthorized'
): Promise<Id<'users'>> {
  return await requireAuthUserId(ctx, message);
}

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
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError('Conversation not found');
    }

    const hiddenFieldPatch: Partial<Doc<'conversations'>> = {};

    if (
      !shouldPreserveHiddenConversationState(
        conversation.buyerInboxHiddenAt,
        conversation.buyerInboxHiddenReason
      )
    ) {
      hiddenFieldPatch.buyerInboxHiddenAt = undefined;
      hiddenFieldPatch.buyerInboxHiddenReason = undefined;
    }

    if (
      !shouldPreserveHiddenConversationState(
        conversation.sellerInboxHiddenAt,
        conversation.sellerInboxHiddenReason
      )
    ) {
      hiddenFieldPatch.sellerInboxHiddenAt = undefined;
      hiddenFieldPatch.sellerInboxHiddenReason = undefined;
    }

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

    let unreadCountPatch: Partial<Doc<'conversations'>>;
    if (conversation.buyerId === args.recipientId) {
      unreadCountPatch = {
        buyerUnreadCount: await getUnreadMessageCount(ctx, args.conversationId, args.recipientId),
      };
    } else if (conversation.sellerId === args.recipientId) {
      unreadCountPatch = {
        sellerUnreadCount: await getUnreadMessageCount(ctx, args.conversationId, args.recipientId),
      };
    } else {
      throw new ConvexError('Conversation recipient mismatch');
    }

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageId: messageId,
      lastMessagePreview: getMessagePreview(args.body),
      lastMessageAt: now,
      ...unreadCountPatch,
      ...hiddenFieldPatch,
    });

    return { messageId };
  },
});

// Sends a message (action — screens content via moderation before persisting)
export const sendMessage = action({
  args: {
    conversationId: v.id('conversations'),
    body: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ messageId: Id<'messages'> }> => {
    const trimmedBody = args.body.trim();
    // Validate message body length
    if (trimmedBody.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (args.body.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
      throw new ConvexError(`Message must be ${PAYLOAD_BOUNDS.MESSAGE_MAX} characters or less`);
    }

    const type = args.type ?? 'text';

    const userId = await requireAuthUserId(ctx);

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

    const senderId = userId;
    const recipientId = isBuyer ? convo.sellerId : convo.buyerId;

    // Block check: neither party can message if either has blocked the other
    const hasBlock = await ctx.runQuery(internal.blocks.internalHasBlockBetween, {
      userIdA: senderId,
      userIdB: recipientId,
    });
    if (hasBlock) {
      throw new ConvexError('You cannot message this user');
    }

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
      senderId,
      recipientId,
      body: args.body,
      type: type,
    });

    // Push notifications are best-effort and should never block message delivery.
    // In production, schedule out-of-band to keep send latency low.
    // In test runs, invoke directly for deterministic assertions and to avoid
    // convex-test scheduler race conditions.
    const notificationArgs = {
      recipientId,
      senderId: userId,
      conversationId: args.conversationId,
      listingId: convo.listingId,
      messageId: result.messageId,
      body: args.body,
    };

    try {
      if (process.env.NODE_ENV === 'test') {
        await ctx.runMutation(
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      }
    } catch (error) {
      logError('messages.push_notification_enqueue_failed', {
        conversationId: args.conversationId,
        recipientId,
        error,
      });
    }

    return result;
  },
});

/**
 * Create a conversation (or reuse existing one) and send the first message in one flow.
 * Used when tapping "Message Seller" from a listing.
 */
export const createConversationAndSendFirstMessage = action({
  args: {
    listingId: v.id('listings'),
    body: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ conversationId: Id<'conversations'> }> => {
    const trimmedBody = args.body.trim();
    if (trimmedBody.length === 0) {
      throw new ConvexError('Message cannot be empty');
    }
    if (args.body.length > PAYLOAD_BOUNDS.MESSAGE_MAX) {
      throw new ConvexError(`Message must be ${PAYLOAD_BOUNDS.MESSAGE_MAX} characters or less`);
    }

    const type = args.type ?? 'text';
    const buyerId = await requireAuthUserId(ctx);

    const listing = await ctx.runQuery(internal.listings.internalGetListing, {
      id: args.listingId,
    });
    if (!listing) throw new ConvexError('Listing not found');
    if (listing.status !== 'active') throw new ConvexError('Listing is not active');
    if (listing.isHidden) throw new ConvexError('Listing is not available');

    const sellerId = listing.sellerId;
    if (buyerId === sellerId) {
      throw new ConvexError("You can't message yourself");
    }

    const hasBlock = await ctx.runQuery(internal.blocks.internalHasBlockBetween, {
      userIdA: buyerId,
      userIdB: sellerId,
    });
    if (hasBlock) {
      throw new ConvexError('You cannot message this user');
    }

    const moderationResult = await ctx.runAction(internal.moderation.moderateContent, {
      text: args.body,
      contentType: 'message',
      userId: buyerId,
    });
    if (moderationResult.flagged) {
      throw new ConvexError('Your message was not sent because it contains inappropriate content.');
    }

    const { conversationId } = await ctx.runMutation(
      internal.messages.internalGetOrCreateConversation,
      { listingId: args.listingId, buyerId, sellerId }
    );

    const result = await ctx.runMutation(internal.messages.internalSendMessage, {
      conversationId,
      listingId: args.listingId,
      senderId: buyerId,
      recipientId: sellerId,
      body: args.body,
      type,
    });

    const notificationArgs = {
      recipientId: sellerId,
      senderId: buyerId,
      conversationId,
      listingId: args.listingId,
      messageId: result.messageId,
      body: args.body,
    };

    try {
      if (process.env.NODE_ENV === 'test') {
        await ctx.runMutation(
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.pushNotifications.sendNewMessageNotification,
          notificationArgs
        );
      }
    } catch (error) {
      logError('messages.push_notification_enqueue_failed', {
        conversationId,
        recipientId: sellerId,
        error,
      });
    }

    return { conversationId };
  },
});

//Debug helper for local testing
export const debugCreateConversationID = internalMutation({
  args: {
    listingId: v.id('listings'),
    buyerId: v.id('users'),
    sellerId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      participantIds: [args.buyerId, args.sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
    });

    return { conversationId };
  },
});

//Retrieve all messages for a conversation with conversationID in chronological order
export const getConversationHistory = query({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationIds } = await requireConversationScope(ctx, args);
    return await collectMessagesForConversationScope(ctx, conversationIds, args.limit);
  },
});

//List all user conversations a user participates in, ordered by most recent activity
export const listUserConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStableUserId(ctx);
    const limit = normalizeQueryLimit(
      args.limit,
      DEFAULT_INBOX_LIMIT,
      MAX_INBOX_LIMIT,
      'Inbox limit'
    );
    const scanLimit = Math.min(MAX_INBOX_SCAN_PER_ROLE, limit * 4);

    const [buyerConversations, sellerConversations] = await Promise.all([
      ctx.db
        .query('conversations')
        .withIndex('by_buyer', (q) => q.eq('buyerId', userId))
        .order('desc')
        .take(scanLimit),
      ctx.db
        .query('conversations')
        .withIndex('by_seller', (q) => q.eq('sellerId', userId))
        .order('desc')
        .take(scanLimit),
    ]);

    const dedupedConversationIds = new Set<Id<'conversations'>>();
    for (const conversation of [...buyerConversations, ...sellerConversations]) {
      dedupedConversationIds.add(conversation._id);
    }

    const participantConversations = (
      await Promise.all(
        [...dedupedConversationIds].map((conversationId) => ctx.db.get(conversationId))
      )
    )
      .filter((conversation): conversation is Doc<'conversations'> => conversation !== null)
      .filter((conversation) => conversation.buyerId === userId || conversation.sellerId === userId)
      .filter((conversation) => {
        if (conversation.buyerId === userId) {
          return conversation.buyerInboxHiddenAt === undefined;
        }
        return conversation.sellerInboxHiddenAt === undefined;
      });

    const visibleConversations = (
      await Promise.all(
        participantConversations.map(async (conversation) => {
          const state = await resolveConversationInboxState(ctx, conversation, userId);
          if (!state) {
            return null;
          }

          return { conversation, state };
        })
      )
    )
      .filter(
        (
          entry
        ): entry is {
          conversation: Doc<'conversations'>;
          state: {
            lastMessagePreview: string;
            lastMessageAt: number;
            unreadCount: number;
            effectiveUpdatedAt: number;
          };
        } => entry !== null
      )
      .sort((left, right) => right.state.effectiveUpdatedAt - left.state.effectiveUpdatedAt)
      .slice(0, limit);

    const listingIds = [
      ...new Set(visibleConversations.map(({ conversation }) => conversation.listingId)),
    ];
    const listingDocs = await Promise.all(listingIds.map((listingId) => ctx.db.get(listingId)));
    const listingById = new Map<Id<'listings'>, Doc<'listings'> | null>();
    for (let index = 0; index < listingIds.length; index += 1) {
      listingById.set(listingIds[index], listingDocs[index]);
    }

    const listingSummariesById = new Map<
      Id<'listings'>,
      { id: Id<'listings'>; title: string; thumbnailUrl: string | null }
    >();
    await Promise.all(
      listingIds.map(async (listingId) => {
        const listing = listingById.get(listingId) ?? null;
        const thumbnailSource = listing?.images?.[0] ?? null;
        let listingThumbnailUrl: string | null = null;
        if (thumbnailSource) {
          if (isRemoteUrl(thumbnailSource)) {
            listingThumbnailUrl = thumbnailSource;
          } else {
            try {
              listingThumbnailUrl = await ctx.storage.getUrl(thumbnailSource as Id<'_storage'>);
            } catch {
              listingThumbnailUrl = null;
            }
          }
        }

        listingSummariesById.set(listingId, {
          id: listingId,
          title: listing?.title ?? 'Listing unavailable',
          thumbnailUrl: listingThumbnailUrl,
        });
      })
    );

    const canonicalOtherUserIds = [
      ...new Set(
        visibleConversations.map(({ conversation }) =>
          conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId
        )
      ),
    ];
    const [userEntries, profileEntries] = await Promise.all([
      Promise.all(
        canonicalOtherUserIds.map(async (otherUserId) => {
          const normalizedOtherUserId = await ctx.db.normalizeId('users', otherUserId);
          const otherUserDoc = normalizedOtherUserId
            ? await ctx.db.get(normalizedOtherUserId)
            : null;
          return [otherUserId, otherUserDoc] as const;
        })
      ),
      Promise.all(
        canonicalOtherUserIds.map(async (otherUserId) => {
          const profile = await ctx.db
            .query('profiles')
            .withIndex('by_userId', (q) => q.eq('userId', otherUserId))
            .first();
          return [otherUserId, profile ?? null] as const;
        })
      ),
    ]);
    const userDocsByCanonicalUserId = new Map<string, Doc<'users'> | null>(userEntries);
    const profilesByCanonicalUserId = new Map<string, Doc<'profiles'> | null>(profileEntries);

    return visibleConversations.map(({ conversation, state }) => {
      const isBuyer = conversation.buyerId === userId;
      const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
      const otherProfile = profilesByCanonicalUserId.get(otherUserId) ?? null;
      const otherUserDoc = userDocsByCanonicalUserId.get(otherUserId) ?? null;

      return {
        ...conversation,
        updatedAt: state.effectiveUpdatedAt,
        mergedConversationId: conversation._id,
        siblingConversationIds: [conversation._id],
        canonicalOtherUserId: otherUserId,
        otherUser: {
          id: otherUserId,
          name: displayNameFromProfile(otherProfile, otherUserDoc),
          picture: otherProfile?.picture,
        },
        listing: listingSummariesById.get(conversation.listingId) ?? {
          id: conversation.listingId,
          title: 'Listing unavailable',
          thumbnailUrl: null,
        },
        lastMessagePreview: state.lastMessagePreview,
        lastMessageAt: state.lastMessageAt,
        unreadCount: state.unreadCount,
        hasUnread: state.unreadCount > 0,
      };
    });
  },
});

export const getReportedConversationListingIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStableUserId(ctx);
    const listingIdSet = await getReportedConversationListingIdSetByReporter(ctx, userId);
    return [...listingIdSet];
  },
});

async function requireConversationScope(
  ctx: MutationCtx | QueryCtx,
  args: {
    conversationId: Id<'conversations'>;
    siblingConversationIds?: Id<'conversations'>[];
  }
) {
  const userId = await requireStableUserId(ctx);
  const scopedConversationIdSet = new Set<Id<'conversations'>>([
    args.conversationId,
    ...(args.siblingConversationIds ?? []),
  ]);
  const scopedConversationIds = [...scopedConversationIdSet];

  const scopedConversations = await Promise.all(
    scopedConversationIds.map((conversationId) => ctx.db.get(conversationId))
  );
  if (scopedConversations.some((conversation) => conversation === null)) {
    throw new ConvexError('Conversation not found');
  }
  const conversations = scopedConversations as Doc<'conversations'>[];
  const primaryConversation = conversations.find(
    (conversation) => conversation._id === args.conversationId
  );
  if (!primaryConversation) {
    throw new ConvexError('Conversation not found');
  }

  const getScopedConversationMeta = (conversation: Doc<'conversations'>) => {
    const isBuyer = conversation.buyerId === userId;
    const isSeller = conversation.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ConvexError('Forbidden');
    }

    const otherUserId = isBuyer ? conversation.sellerId : conversation.buyerId;
    return {
      conversation,
      isBuyer,
      isSeller,
      dedupeKey: `${conversation.listingId}:${otherUserId}`,
    };
  };

  const primaryMeta = getScopedConversationMeta(primaryConversation);
  const conversationScope = conversations.map((conversation) => {
    const scopedMeta = getScopedConversationMeta(conversation);
    if (scopedMeta.dedupeKey !== primaryMeta.dedupeKey) {
      throw new ConvexError('Forbidden');
    }
    return {
      conversation,
      isBuyer: scopedMeta.isBuyer,
      isSeller: scopedMeta.isSeller,
    };
  });

  return {
    userId,
    conversationIds: conversationScope.map(
      (scopedConversation) => scopedConversation.conversation._id
    ),
    conversationScope,
  };
}

async function collectMessagesForConversationScope(
  ctx: MutationCtx | QueryCtx,
  conversationIds: Id<'conversations'>[],
  limit?: number
) {
  const normalizedLimit = normalizeQueryLimit(
    limit,
    DEFAULT_MESSAGE_HISTORY_LIMIT,
    MAX_MESSAGE_HISTORY_LIMIT,
    'Message history limit'
  );
  const messageBatches = await Promise.all(
    conversationIds.map((conversationId) =>
      ctx.db
        .query('messages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId))
        .order('desc')
        .take(normalizedLimit)
    )
  );

  return messageBatches
    .flat()
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-normalizedLimit);
}

async function collectMessagePageForConversationScope(
  ctx: MutationCtx | QueryCtx,
  conversationIds: Id<'conversations'>[],
  paginationOpts: {
    numItems: number;
    cursor: string | null;
  }
) {
  validatePaginatedBatchSize(paginationOpts.numItems, 'Message page', MAX_MESSAGE_PAGE_SIZE);
  const cursor = decodeMessagePageCursor(paginationOpts.cursor);
  const perConversationFetchLimit = paginationOpts.numItems + (cursor ? 2 : 1);

  const messageBatches = await Promise.all(
    conversationIds.map(async (conversationId) => {
      const batch = await ctx.db
        .query('messages')
        .withIndex('by_conversation_createdAt', (q) => {
          const scopedQuery = q.eq('conversationId', conversationId);
          if (!cursor) {
            return scopedQuery;
          }
          return scopedQuery.lte('createdAt', cursor.createdAt);
        })
        .order('desc')
        .take(perConversationFetchLimit);

      if (!cursor) {
        return batch;
      }

      return batch.filter((message) => isMessageStrictlyOlderThanCursor(message, cursor));
    })
  );

  const pageDescending = messageBatches
    .flat()
    .sort(compareMessagesDescending)
    .slice(0, paginationOpts.numItems + 1);

  const page = pageDescending.slice(0, paginationOpts.numItems);
  const continueCursor =
    pageDescending.length > paginationOpts.numItems && page.length > 0
      ? encodeMessagePageCursor(page[page.length - 1])
      : null;

  return {
    page: [...page].sort(compareMessagesAscending),
    continueCursor,
    isDone: continueCursor === null,
  };
}

function normalizeAndValidateReportNotes(reason: ReportReason, notes?: string) {
  const trimmedNotes = notes?.trim();
  if (trimmedNotes && trimmedNotes.length > MAX_REPORT_NOTES_LENGTH) {
    throw new ConvexError(`Notes must be ${MAX_REPORT_NOTES_LENGTH} characters or less`);
  }

  if (reason === 'other' && (!trimmedNotes || trimmedNotes.length === 0)) {
    throw new ConvexError('Please provide details when selecting "Other" as the reason');
  }

  return trimmedNotes;
}

async function enforceReportRateLimit(ctx: MutationCtx, userId: Id<'users'>) {
  const oneDayAgo = Date.now() - ONE_DAY_MS;
  const recentReports = await ctx.db
    .query('reports')
    .withIndex('by_reporter', (q) => q.eq('reporterId', userId))
    .filter((q) => q.gt(q.field('createdAt'), oneDayAgo))
    .collect();

  if (recentReports.length >= MAX_REPORTS_PER_DAY) {
    throw new ConvexError('Report limit reached. Please try again later.');
  }
}

async function hideConversationForParticipant(
  ctx: MutationCtx,
  conversation: Doc<'conversations'>,
  userId: Id<'users'>,
  reason: ConversationInboxHiddenReason,
  hiddenAt: number
) {
  if (conversation.buyerId === userId) {
    await ctx.db.patch(conversation._id, {
      buyerInboxHiddenAt: hiddenAt,
      buyerInboxHiddenReason: reason,
    });
    return;
  }

  if (conversation.sellerId === userId) {
    await ctx.db.patch(conversation._id, {
      sellerInboxHiddenAt: hiddenAt,
      sellerInboxHiddenReason: reason,
    });
    return;
  }

  throw new ConvexError('Forbidden');
}

async function updateConversationAfterDeletedMessage(
  ctx: MutationCtx,
  conversation: Doc<'conversations'>,
  _deletedMessageId: Id<'messages'>
) {
  const nextState = await buildConversationMessageStatePatch(ctx, conversation);
  const patch = buildConversationStateDiff(conversation, nextState);
  if (Object.keys(patch).length === 0) {
    return;
  }
  await ctx.db.patch(conversation._id, patch);
}

// Internal: create conversation if not exists (used by createConversationAndSendFirstMessage)
export const internalGetOrCreateConversation = internalMutation({
  args: {
    listingId: v.id('listings'),
    buyerId: v.string(),
    sellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', args.buyerId).eq('sellerId', args.sellerId)
      )
      .first();

    if (existing) return { conversationId: existing._id };

    const now = Date.now();
    const conversationId = await ctx.db.insert('conversations', {
      listingId: args.listingId,
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      participantIds: [args.buyerId, args.sellerId],
      createdAt: now,
      updatedAt: now,
      buyerLastReadAt: now,
      sellerLastReadAt: now,
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
    });

    return { conversationId };
  },
});

export const getOrCreateConversation = mutation({
  args: {
    listingId: v.id('listings'),
  },
  handler: async (ctx, args) => {
    const buyerId = await requireStableUserId(ctx);

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
    if (buyerId === sellerId) {
      throw new ConvexError("You can't message yourself");
    }

    // Block check: neither party can message if either has blocked the other
    const blocked = await hasBlockBetween(ctx, buyerId, sellerId);
    if (blocked) {
      throw new ConvexError('You cannot message this user');
    }

    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_listing_buyer_seller', (q) =>
        q.eq('listingId', args.listingId).eq('buyerId', buyerId).eq('sellerId', sellerId)
      )
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
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
    });

    return { conversationId };
  },
});

// TASK: mark messages as read functionality
export const markMessagesAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const { conversationScope, userId } = await requireConversationScope(ctx, args);

    const now = Date.now();

    await Promise.all(
      conversationScope.map(async ({ conversation, isBuyer, isSeller }) => {
        if (isBuyer) {
          await ctx.db.patch(conversation._id, { buyerLastReadAt: now, buyerUnreadCount: 0 });
        } else if (isSeller) {
          await ctx.db.patch(conversation._id, { sellerLastReadAt: now, sellerUnreadCount: 0 });
        }
      })
    );

    const unreadMessagesByScope = await Promise.all(
      conversationScope.map(({ conversation }) =>
        ctx.db
          .query('messages')
          .withIndex('by_conversation_recipient_readAt', (q) =>
            q.eq('conversationId', conversation._id).eq('recipientId', userId).eq('readAt', 0)
          )
          .collect()
      )
    );
    const unreadMessageIds = new Set<Id<'messages'>>();
    for (const unreadBatch of unreadMessagesByScope) {
      for (const message of unreadBatch) {
        unreadMessageIds.add(message._id);
      }
    }
    await Promise.all(
      [...unreadMessageIds].map((messageId) => ctx.db.patch(messageId, { readAt: now }))
    );

    return { ok: true };
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError('Message not found');
    }

    const { userId, conversationScope } = await requireConversationScope(ctx, {
      conversationId: message.conversationId,
    });
    const conversation = conversationScope[0]?.conversation;
    if (!conversation) {
      throw new ConvexError('Conversation not found');
    }

    if (message.senderId !== userId) {
      throw new ConvexError('You can only delete your own messages');
    }

    await ctx.db.delete(args.messageId);
    await updateConversationAfterDeletedMessage(ctx, conversation, args.messageId);
    return { ok: true };
  },
});

export const hideConversationFromInbox = mutation({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const { conversationScope, userId } = await requireConversationScope(ctx, args);
    const now = Date.now();

    await Promise.all(
      conversationScope.map(({ conversation, isBuyer, isSeller }) => {
        const currentHiddenReason = isBuyer
          ? conversation.buyerInboxHiddenReason
          : isSeller
            ? conversation.sellerInboxHiddenReason
            : undefined;

        if (currentHiddenReason === 'reported') {
          return Promise.resolve();
        }

        return hideConversationForParticipant(ctx, conversation, userId, 'deleted', now);
      })
    );

    return { ok: true };
  },
});

export const reportMessage = mutation({
  args: {
    messageId: v.id('messages'),
    reason: REPORT_REASON_VALIDATOR,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError('Message not found');
    }

    const { userId, conversationScope } = await requireConversationScope(ctx, {
      conversationId: message.conversationId,
    });
    const conversation = conversationScope[0]?.conversation;
    if (!conversation) {
      throw new ConvexError('Conversation not found');
    }

    if (message.senderId === userId) {
      throw new ConvexError('You can only report messages from the other participant');
    }

    const trimmedNotes = normalizeAndValidateReportNotes(args.reason, args.notes);

    const existingReport = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) => q.eq('targetId', args.messageId).eq('targetType', 'message'))
      .filter((q) => q.eq(q.field('reporterId'), userId))
      .first();

    if (existingReport) {
      throw new ConvexError('You have already reported this message');
    }

    await enforceReportRateLimit(ctx, userId);

    const reportId = await ctx.db.insert('reports', {
      targetId: args.messageId,
      targetType: 'message',
      reporterId: userId,
      reason: args.reason,
      notes: trimmedNotes,
      createdAt: Date.now(),
    });

    // Intentionally hide only the primary conversation here; siblingConversationIds handling
    // exists in reportConversation/hideConversationFromInbox where those args are available.
    await hideConversationForParticipant(ctx, conversation, userId, 'reported', Date.now());

    return { reportId };
  },
});

export const reportConversation = mutation({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
    reason: REPORT_REASON_VALIDATOR,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, conversationScope } = await requireConversationScope(ctx, args);
    const trimmedNotes = normalizeAndValidateReportNotes(args.reason, args.notes);

    const existingReport = await ctx.db
      .query('reports')
      .withIndex('by_target', (q) =>
        q.eq('targetId', args.conversationId).eq('targetType', 'conversation')
      )
      .filter((q) => q.eq(q.field('reporterId'), userId))
      .first();

    if (existingReport) {
      throw new ConvexError('You have already reported this conversation');
    }

    await enforceReportRateLimit(ctx, userId);

    const reportId = await ctx.db.insert('reports', {
      targetId: args.conversationId,
      targetType: 'conversation',
      reporterId: userId,
      reason: args.reason,
      notes: trimmedNotes,
      createdAt: Date.now(),
    });

    const now = Date.now();
    await Promise.all(
      conversationScope.map(({ conversation }) =>
        hideConversationForParticipant(ctx, conversation, userId, 'reported', now)
      )
    );

    return { reportId };
  },
});

// TASK: real-time message delivery (Convex query is reactive when used with useQuery)
export const backfillMessagingFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query('conversations').collect();
    let conversationPatches = 0;

    for (const convo of conversations) {
      const participantIdsPatch =
        !convo.participantIds || convo.participantIds.length !== 2
          ? { participantIds: [convo.buyerId, convo.sellerId] }
          : {};
      const nextMessageState = await buildConversationMessageStatePatch(ctx, convo);
      const messageStatePatch = buildConversationStateDiff(convo, nextMessageState);
      const patch = { ...participantIdsPatch, ...messageStatePatch };

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(convo._id, patch);
        conversationPatches += 1;
      }
    }

    const messages = await ctx.db.query('messages').collect();
    let messagePatches = 0;

    for (const message of messages) {
      if (!message.type) {
        await ctx.db.patch(message._id, { type: 'text' });
        messagePatches += 1;
      }
    }

    return { conversationPatches, messagePatches };
  },
});

export const backfillMessagingFieldsBatch = internalMutation({
  args: {
    conversationPagination: v.optional(paginationOptsValidator),
    messagePagination: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const hasConversationPagination = args.conversationPagination !== undefined;
    const hasMessagePagination = args.messagePagination !== undefined;

    if (hasConversationPagination === hasMessagePagination) {
      throw new ConvexError('Provide exactly one of conversationPagination or messagePagination');
    }

    if (args.conversationPagination) {
      const conversationPagination = args.conversationPagination ?? {
        numItems: DEFAULT_BACKFILL_BATCH_SIZE,
        cursor: null,
      };

      validatePaginatedBatchSize(
        conversationPagination.numItems,
        'Conversation backfill batch',
        MAX_BACKFILL_BATCH_SIZE
      );

      const conversationPage = await ctx.db.query('conversations').paginate(conversationPagination);

      let conversationPatches = 0;
      for (const convo of conversationPage.page) {
        const participantIdsPatch =
          !convo.participantIds || convo.participantIds.length !== 2
            ? { participantIds: [convo.buyerId, convo.sellerId] }
            : {};
        const nextMessageState = await buildConversationMessageStatePatch(ctx, convo);
        const messageStatePatch = buildConversationStateDiff(convo, nextMessageState);
        const patch = { ...participantIdsPatch, ...messageStatePatch };

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(convo._id, patch);
          conversationPatches += 1;
        }
      }

      return {
        target: 'conversations' as const,
        conversationPatches,
        messagePatches: 0,
        conversationScanned: conversationPage.page.length,
        messageScanned: 0,
        conversationContinueCursor: conversationPage.isDone
          ? null
          : conversationPage.continueCursor,
        messageContinueCursor: null,
        isDone: conversationPage.isDone,
      };
    }

    const messagePagination = args.messagePagination ?? {
      numItems: DEFAULT_BACKFILL_BATCH_SIZE,
      cursor: null,
    };

    validatePaginatedBatchSize(
      messagePagination.numItems,
      'Message backfill batch',
      MAX_BACKFILL_BATCH_SIZE
    );

    const messagePage = await ctx.db.query('messages').paginate(messagePagination);

    let messagePatches = 0;
    for (const message of messagePage.page) {
      if (!message.type) {
        await ctx.db.patch(message._id, { type: 'text' });
        messagePatches += 1;
      }
    }

    return {
      target: 'messages' as const,
      conversationPatches: 0,
      messagePatches,
      conversationScanned: 0,
      messageScanned: messagePage.page.length,
      conversationContinueCursor: null,
      messageContinueCursor: messagePage.isDone ? null : messagePage.continueCursor,
      isDone: messagePage.isDone,
    };
  },
});

export const messagesByConversation = query({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationIds } = await requireConversationScope(ctx, args);
    return await collectMessagesForConversationScope(ctx, conversationIds, args.limit);
  },
});

export const messagesByConversationPage = query({
  args: {
    conversationId: v.id('conversations'),
    siblingConversationIds: v.optional(v.array(v.id('conversations'))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { conversationIds } = await requireConversationScope(ctx, args);
    return await collectMessagePageForConversationScope(ctx, conversationIds, args.paginationOpts);
  },
});

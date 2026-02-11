import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  listings: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    sellerId: v.string(), // Auth identity subject
    images: v.array(v.string()),
    condition: v.union(v.literal('new'), v.literal('used'), v.literal('refurbished')),
    category: v.union(
      v.literal('textbooks'),
      v.literal('electronics'),
      v.literal('furniture'),
      v.literal('tickets'),
      v.literal('other')
    ),
    status: v.union(
      v.literal('active'),
      v.literal('sold'),
      v.literal('inactive'),
      v.literal('deleted')
    ),
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenReason: v.optional(v.string()),
    createdAt: v.number(),
    postedOn: v.number(),
    tags: v.optional(v.array(v.string())),
  })
    .index('by_status', ['status'])
    .index('by_category', ['category'])
    .index('by_status_category', ['status', 'category'])
    .index('by_status_createdAt', ['status', 'createdAt'])
    .index('by_status_category_createdAt', ['status', 'category', 'createdAt'])
    .index('by_status_price', ['status', 'price'])
    .index('by_status_category_price', ['status', 'category', 'price'])
    .index('by_status_condition_createdAt', ['status', 'condition', 'createdAt'])
    .index('by_status_category_condition_createdAt', [
      'status',
      'category',
      'condition',
      'createdAt',
    ])
    .index('by_tag', ['tags'])
    .searchIndex('search_listings', {
      searchField: 'title',
      filterFields: ['status', 'category', 'condition', 'description'],
    }),

  profiles: defineTable({
    userId: v.string(), // Auth identity subject
    name: v.string(),
    email: v.string(),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    joinDate: v.number(),
    major: v.string(),
    year: v.number(),
    rating: v.number(),
    review_count: v.number(),
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenReason: v.optional(v.string()),
  })
    .index('by_name', ['name'])
    .index('by_userId', ['userId']),
  users: defineTable({
    // Convex Auth-compatible fields
    name: v.optional(v.union(v.string(), v.null())),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // App-specific fields
    emailVerified: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
  })
    .index('phone', ['phone'])
    .index('by_email', ['email']),

  authSessions: defineTable({
    userId: v.id('users'),
    expirationTime: v.number(),
  }).index('userId', ['userId']),

  authAccounts: defineTable({
    userId: v.id('users'),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index('userIdAndProvider', ['userId', 'provider'])
    .index('providerAndAccountId', ['provider', 'providerAccountId']),

  authRefreshTokens: defineTable({
    sessionId: v.id('authSessions'),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id('authRefreshTokens')),
  })
    .index('sessionId', ['sessionId'])
    .index('sessionIdAndParentRefreshTokenId', ['sessionId', 'parentRefreshTokenId']),

  authVerificationCodes: defineTable({
    accountId: v.id('authAccounts'),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index('accountId', ['accountId'])
    .index('code', ['code']),

  authVerifiers: defineTable({
    sessionId: v.optional(v.id('authSessions')),
    signature: v.optional(v.string()),
  }).index('signature', ['signature']),

  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsLeft: v.number(),
  }).index('identifier', ['identifier']),

  reports: defineTable({
    targetId: v.string(), // Can be listing or profile ID
    targetType: v.union(v.literal('listing'), v.literal('profile')),
    reporterId: v.string(), // Auth identity subject
    reason: v.union(v.literal('scam'), v.literal('inappropriate'), v.literal('spam')),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_target', ['targetId', 'targetType'])
    .index('by_reporter', ['reporterId']),
  conversations: defineTable({
    listingId: v.id('listings'),
    buyerId: v.string(), // Auth identity subject
    sellerId: v.string(), // Auth identity subject
    createdAt: v.number(),
    updatedAt: v.number(),
    buyerLastReadAt: v.number(),
    sellerLastReadAt: v.number(),
  })
    .index('by_listing_buyer_seller', ['listingId', 'buyerId'])
    .index('by_buyer', ['buyerId', 'updatedAt'])
    .index('by_seller', ['sellerId', 'updatedAt'])
    .index('by_listing', ['listingId']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    senderId: v.string(), // Auth identity subject
    recipientId: v.string(), // Auth identity subject
    body: v.string(),
    createdAt: v.number(),
    readAt: v.number(),
  })
    .index('by_conversation_createdAt', ['conversationId', 'createdAt'])
    .index('by_conversation_recipient_readAt', ['conversationId', 'recipientId', 'readAt']),
});

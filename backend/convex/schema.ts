import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index('phone', ['phone'])
    .index('email', ['email']),

  listings: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    sellerId: v.string(), // Auth identity subject
    sellerEmail: v.optional(v.string()),
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
    .index('by_seller', ['sellerId', 'createdAt'])
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

  reports: defineTable({
    targetId: v.string(), // Can be listing or profile ID
    targetType: v.union(v.literal('listing'), v.literal('profile')),
    reporterId: v.string(), // Auth identity subject
    reason: v.union(v.literal('scam'), v.literal('inappropriate'), v.literal('spam')),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_target', ['targetId', 'targetType'])
    .index('by_reporter', ['reporterId'])
    // Compound index for O(1) duplicate-report check (replaces by_target scan + filter)
    .index('by_target_reporter', ['targetId', 'targetType', 'reporterId']),

  conversations: defineTable({
    listingId: v.id('listings'),
    buyerId: v.string(), // Auth identity subject
    sellerId: v.string(), // Auth identity subject
    participantIds: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    buyerLastReadAt: v.number(),
    sellerLastReadAt: v.number(),
    lastMessageId: v.optional(v.id('messages')),
  })
    .index('by_listing_buyer_seller', ['listingId', 'buyerId', 'sellerId'])
    .index('by_buyer', ['buyerId', 'updatedAt'])
    .index('by_seller', ['sellerId', 'updatedAt'])
    .index('by_listing', ['listingId']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    senderId: v.string(), // Auth identity subject
    recipientId: v.string(), // Auth identity subject
    body: v.string(),
    type: v.optional(v.union(v.literal('text'), v.literal('system'))),
    createdAt: v.number(),
    readAt: v.number(),
  })
    .index('by_conversation_createdAt', ['conversationId', 'createdAt'])
    .index('by_conversation_recipient_readAt', ['conversationId', 'recipientId', 'readAt']),

  moderationResults: defineTable({
    contentType: v.union(v.literal('listing'), v.literal('message')),
    contentId: v.optional(v.string()),
    inputText: v.string(),
    flagged: v.boolean(),
    categories: v.optional(v.string()), // JSON-stringified category results
    userId: v.string(),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_contentType', ['contentType', 'createdAt']),
});

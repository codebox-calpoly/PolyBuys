import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';
import { isCalPolyEmail } from '@polybuys/shared';

export const PAYLOAD_BOUNDS = {
  NAME_MIN: 1,
  NAME_MAX: 100,
  BIO_MAX: 500,
  MAJOR_MIN: 1,
  MAJOR_MAX: 100,
};

const MAX_PROFILE_NAME_MATCHES = 100;
const PROFILE_PAGE_SIZE = {
  MIN: 1,
  MAX: 100,
} as const;
const INVALID_CURSOR_FORMAT_MESSAGE = 'invalid cursor format';
const YEAR_BOUNDS = {
  MIN: 1900,
  MAX: 9999,
};
const PROFILE_UPLOAD_RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000,
  WINDOW_MAX: 30,
  DAY_MS: 24 * 60 * 60 * 1000,
  DAY_MAX: 120,
} as const;

function validateYear(year: number) {
  if (!Number.isInteger(year) || year < YEAR_BOUNDS.MIN || year > YEAR_BOUNDS.MAX) {
    throw new ConvexError(`Year must be between ${YEAR_BOUNDS.MIN} and ${YEAR_BOUNDS.MAX}`);
  }
}

function isLikelyConvexNativeCursor(cursor: string) {
  return cursor === '_end_cursor' || /^[A-Za-z0-9]+$/.test(cursor);
}

function validateProfilePaginationOrThrow(paginationOpts: {
  numItems: number;
  cursor: string | null;
}) {
  if (
    paginationOpts.numItems < PROFILE_PAGE_SIZE.MIN ||
    paginationOpts.numItems > PROFILE_PAGE_SIZE.MAX
  ) {
    throw new ConvexError(
      `numItems must be between ${PROFILE_PAGE_SIZE.MIN} and ${PROFILE_PAGE_SIZE.MAX}`
    );
  }

  if (paginationOpts.cursor !== null && !isLikelyConvexNativeCursor(paginationOpts.cursor)) {
    throw new ConvexError(INVALID_CURSOR_FORMAT_MESSAGE);
  }
}

/**
 * Sanitizes a profile to only include public fields.
 * Filters out PII like email, hiddenReason, hiddenAt, userId.
 */
function toPublicProfile(profile: Doc<'profiles'>) {
  return {
    _id: profile._id,
    name: profile.name,
    bio: profile.bio,
    picture: profile.picture,
    joinDate: profile.joinDate,
    major: profile.major,
    year: profile.year,
    rating: profile.rating,
    review_count: profile.review_count,
  };
}

// Get all profiles (public, non-hidden only)
export const getProfiles = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    validateProfilePaginationOrThrow(args.paginationOpts);

    // Filter hidden profiles at the DB level so pagination page sizes are accurate.
    // Post-paginate filtering would silently return fewer than numItems per page,
    // breaking infinite-scroll consumers.
    let result;
    try {
      result = await ctx.db
        .query('profiles')
        .filter((q) => q.neq(q.field('isHidden'), true))
        .paginate(args.paginationOpts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.paginationOpts.cursor !== null && /cursor/i.test(message)) {
        throw new ConvexError(INVALID_CURSOR_FORMAT_MESSAGE);
      }
      throw error;
    }

    // Sanitize PII before returning
    const publicProfiles = result.page.map(toPublicProfile);

    return {
      ...result,
      page: publicProfiles,
    };
  },
});

// Get user profile by name (public, non-hidden only)
export const getProfilebyName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const profiles = await ctx.db
      .query('profiles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .take(MAX_PROFILE_NAME_MATCHES);

    if (profiles.length === 0) return null;

    // Filter out hidden profiles and sanitize
    const publicProfiles = profiles.filter((profile) => !profile.isHidden).map(toPublicProfile);

    return publicProfiles.length > 0 ? publicProfiles : null;
  },
});

// Get the current authenticated user's own full profile (includes hidden/hiddenReason)
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();
  },
});

// Create profile
export const createProfile = mutation({
  args: {
    name: v.string(),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    major: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('You must be logged in to create a profile');
    }
    if (!identity.email) {
      throw new ConvexError('Authenticated user email is required to create a profile');
    }

    const email = identity.email.toLowerCase().trim();
    if (!email) {
      throw new ConvexError('Authenticated user email is required to create a profile');
    }
    if (!isCalPolyEmail(email)) {
      throw new ConvexError('Email must be a @calpoly.edu address');
    }

    // Validate inputs
    if (args.name.length < PAYLOAD_BOUNDS.NAME_MIN || args.name.length > PAYLOAD_BOUNDS.NAME_MAX) {
      throw new ConvexError(
        `Name must be ${PAYLOAD_BOUNDS.NAME_MIN}-${PAYLOAD_BOUNDS.NAME_MAX} characters`
      );
    }
    if (args.bio && args.bio.length > PAYLOAD_BOUNDS.BIO_MAX) {
      throw new ConvexError(`Bio must be ${PAYLOAD_BOUNDS.BIO_MAX} characters or less`);
    }
    if (
      args.major.length < PAYLOAD_BOUNDS.MAJOR_MIN ||
      args.major.length > PAYLOAD_BOUNDS.MAJOR_MAX
    ) {
      throw new ConvexError(
        `Major must be ${PAYLOAD_BOUNDS.MAJOR_MIN}-${PAYLOAD_BOUNDS.MAJOR_MAX} characters`
      );
    }
    validateYear(args.year);

    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();
    if (existingProfile) {
      throw new ConvexError('Profile already exists for this user');
    }

    const profileId = await ctx.db.insert('profiles', {
      userId: identity.subject,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
      email,
      ...args,
    });

    return profileId;
  },
});

// Update profile
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    major: v.optional(v.string()),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('You must be logged in');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!profile) throw new ConvexError('Profile not found');

    const update: Partial<Doc<'profiles'>> = {};

    if (args.name !== undefined) {
      if (
        args.name.length < PAYLOAD_BOUNDS.NAME_MIN ||
        args.name.length > PAYLOAD_BOUNDS.NAME_MAX
      ) {
        throw new ConvexError(
          `Name must be ${PAYLOAD_BOUNDS.NAME_MIN}-${PAYLOAD_BOUNDS.NAME_MAX} characters`
        );
      }
      update.name = args.name;
    }
    if (args.bio !== undefined) {
      if (args.bio.length > PAYLOAD_BOUNDS.BIO_MAX) {
        throw new ConvexError(`Bio must be ${PAYLOAD_BOUNDS.BIO_MAX} characters or less`);
      }
      update.bio = args.bio;
    }
    if (args.picture !== undefined) update.picture = args.picture;
    if (args.major !== undefined) {
      if (
        args.major.length < PAYLOAD_BOUNDS.MAJOR_MIN ||
        args.major.length > PAYLOAD_BOUNDS.MAJOR_MAX
      ) {
        throw new ConvexError(
          `Major must be ${PAYLOAD_BOUNDS.MAJOR_MIN}-${PAYLOAD_BOUNDS.MAJOR_MAX} characters`
        );
      }
      update.major = args.major;
    }
    if (args.year !== undefined) {
      validateYear(args.year);
      update.year = args.year;
    }

    if (Object.keys(update).length === 0) {
      throw new ConvexError('No valid fields to update');
    }

    await ctx.db.patch(profile._id, update);
  },
});

// Upload profile picture
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('You must be logged in');

    const now = Date.now();
    const userId = identity.subject;

    const [recentWindow, recentDay] = await Promise.all([
      ctx.db
        .query('profileImageUploadEvents')
        .withIndex('by_user_type_createdAt', (q) =>
          q
            .eq('userId', userId)
            .eq('eventType', 'issued')
            .gt('createdAt', now - PROFILE_UPLOAD_RATE_LIMIT.WINDOW_MS)
        )
        .take(PROFILE_UPLOAD_RATE_LIMIT.WINDOW_MAX + 1),
      ctx.db
        .query('profileImageUploadEvents')
        .withIndex('by_user_type_createdAt', (q) =>
          q
            .eq('userId', userId)
            .eq('eventType', 'issued')
            .gt('createdAt', now - PROFILE_UPLOAD_RATE_LIMIT.DAY_MS)
        )
        .take(PROFILE_UPLOAD_RATE_LIMIT.DAY_MAX + 1),
    ]);

    if (recentWindow.length >= PROFILE_UPLOAD_RATE_LIMIT.WINDOW_MAX) {
      await ctx.db.insert('profileImageUploadEvents', {
        userId,
        eventType: 'blocked',
        reason: 'rate_limit_15m',
        createdAt: now,
      });
      throw new ConvexError('Upload limit reached. Please wait a few minutes and try again.');
    }

    if (recentDay.length >= PROFILE_UPLOAD_RATE_LIMIT.DAY_MAX) {
      await ctx.db.insert('profileImageUploadEvents', {
        userId,
        eventType: 'blocked',
        reason: 'rate_limit_day',
        createdAt: now,
      });
      throw new ConvexError('Daily upload limit reached. Please try again tomorrow.');
    }

    await ctx.db.insert('profileImageUploadEvents', {
      userId,
      eventType: 'issued',
      createdAt: now,
    });

    return await ctx.storage.generateUploadUrl();
  },
});
export const setProfilePicture = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('You must be logged in');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!profile) throw new ConvexError('Profile not found');

    await ctx.db.patch(profile._id, { picture: args.storageId });
  },
});

// View user's rating and review count (public, non-hidden only)
export const viewRatingReview = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const ratingReview = await ctx.db
      .query('profiles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .take(MAX_PROFILE_NAME_MATCHES);

    // Filter out hidden profiles
    return ratingReview
      .filter((profile) => !profile.isHidden)
      .map((ratingReview) => ({
        rating: ratingReview.rating,
        review_count: ratingReview.review_count,
      }));
  },
});

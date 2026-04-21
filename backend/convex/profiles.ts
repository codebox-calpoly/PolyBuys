import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';
import { PROFILE_BOUNDS } from '@polybuys/shared';
import { getStableUserId, requireAuthUserId } from './lib/authIdentity';
import { validateStoredImageOrThrow } from './lib/storageImageValidation';

export const PAYLOAD_BOUNDS = {
  ...PROFILE_BOUNDS,
};

const RESERVED_PROFILE_FIELDS = [
  'joinDate',
  'rating',
  'review_count',
  'isHidden',
  'hiddenAt',
  'hiddenReason',
] as const;

function normalizeEmailInput(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new ConvexError('Please provide a valid email address');
  }
  return normalized;
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
    const result = await ctx.db.query('profiles').paginate(args.paginationOpts);

    // Filter out hidden profiles and sanitize
    const publicProfiles = result.page.filter((profile) => !profile.isHidden).map(toPublicProfile);

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
      .collect();

    if (profiles.length === 0) return null;

    // Filter out hidden profiles and sanitize
    const publicProfiles = profiles.filter((profile) => !profile.isHidden).map(toPublicProfile);

    return publicProfiles.length > 0 ? publicProfiles : null;
  },
});

// Get public profile by userId (auth identity subject). Used for listing seller blocks.
export const getProfileByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique();
    if (!profile || profile.isHidden) return null;
    return toPublicProfile(profile);
  },
});

// Get the current authenticated user's full profile (including non-public fields)
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getStableUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
  },
});

// Create profile
export const createProfile = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    major: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const emailFromIdentity = identity?.email?.toLowerCase().trim();
    const email = args.email ? normalizeEmailInput(args.email) : emailFromIdentity;
    if (!email) {
      throw new ConvexError('Email is required to create a profile');
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

    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();
    if (existingProfile) {
      throw new ConvexError('Profile already exists for this user');
    }

    if (args.picture) {
      await validateStoredImageOrThrow(ctx, args.picture, 'Profile picture');
    }

    const profileId = await ctx.db.insert('profiles', {
      userId,
      name: args.name,
      email,
      bio: args.bio,
      picture: args.picture,
      major: args.major,
      year: args.year,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
    });

    return profileId;
  },
});

// Update profile
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    picture: v.optional(v.union(v.id('_storage'), v.null())),
    major: v.optional(v.string()),
    year: v.optional(v.number()),
    joinDate: v.optional(v.number()),
    rating: v.optional(v.number()),
    review_count: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    if (!profile) throw new ConvexError('Profile not found');

    const ignoredReservedFields = RESERVED_PROFILE_FIELDS.filter(
      (field) => args[field] !== undefined
    );
    if (ignoredReservedFields.length > 0) {
      console.warn(
        `[profiles.updateProfile] Ignoring reserved fields: ${ignoredReservedFields.join(', ')}`
      );
    }

    const update: Partial<Doc<'profiles'>> = {};
    let previousPictureToDelete: Doc<'profiles'>['picture'] | undefined;

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
    // Backwards compatibility: released clients still send `email` on profile updates.
    // Ignore it so the authenticated Cal Poly email remains immutable after onboarding.
    // These stay in the args schema so older clients keep working, but they are
    // server-controlled and must never be client-mutable.
    for (const reservedField of RESERVED_PROFILE_FIELDS) {
      void args[reservedField];
    }
    if (args.bio !== undefined) {
      if (args.bio.length > PAYLOAD_BOUNDS.BIO_MAX) {
        throw new ConvexError(`Bio must be ${PAYLOAD_BOUNDS.BIO_MAX} characters or less`);
      }
      update.bio = args.bio;
    }
    if (args.picture !== undefined) {
      if (args.picture === null) {
        previousPictureToDelete = profile.picture;
        update.picture = undefined;
      } else {
        if (profile.picture !== args.picture) {
          await validateStoredImageOrThrow(ctx, args.picture, 'Profile picture');
          previousPictureToDelete = profile.picture;
        }
        update.picture = args.picture;
      }
    }
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
      if (
        !Number.isInteger(args.year) ||
        args.year < PAYLOAD_BOUNDS.MIN_YEAR ||
        args.year > PAYLOAD_BOUNDS.MAX_YEAR
      ) {
        throw new ConvexError(
          `Year must be an integer between ${PAYLOAD_BOUNDS.MIN_YEAR} and ${PAYLOAD_BOUNDS.MAX_YEAR}`
        );
      }
      update.year = args.year;
    }

    if (Object.keys(update).length === 0) {
      throw new ConvexError('No valid fields to update');
    }

    await ctx.db.patch(profile._id, update);

    if (previousPictureToDelete && previousPictureToDelete !== args.picture) {
      try {
        await ctx.storage.delete(previousPictureToDelete);
      } catch {
        // Non-fatal: keep profile update path resilient.
      }
    }
  },
});

// Upload profile picture
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
export const setProfilePicture = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    if (!profile) throw new ConvexError('Profile not found');

    if (profile.picture !== args.storageId) {
      await validateStoredImageOrThrow(ctx, args.storageId, 'Profile picture');
    }

    await ctx.db.patch(profile._id, { picture: args.storageId });

    if (profile.picture && profile.picture !== args.storageId) {
      try {
        await ctx.storage.delete(profile.picture);
      } catch {
        // Non-fatal: keep profile update path resilient.
      }
    }
  },
});

export const getProfilePictureUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// View own active listings
export const viewActiveListings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query('listings')
      .filter((q) => q.eq(q.field('sellerId'), userId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect();
  },
});

// View user's rating and review count (public, non-hidden only)
export const viewRatingReview = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const ratingReview = await ctx.db
      .query('profiles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .collect();

    // Filter out hidden profiles
    return ratingReview
      .filter((profile) => !profile.isHidden)
      .map((ratingReview) => ({
        rating: ratingReview.rating,
        review_count: ratingReview.review_count,
      }));
  },
});

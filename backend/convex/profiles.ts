import { v, ConvexError } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';

export const PAYLOAD_BOUNDS = {
  NAME_MIN: 1,
  NAME_MAX: 100,
  BIO_MAX: 500,
  MAJOR_MIN: 1,
  MAJOR_MAX: 100,
};

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
    if (args.year !== undefined) update.year = args.year;

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

// View own active listings
export const viewActiveListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('You must be logged in');
    return await ctx.db
      .query('listings')
      .filter((q) => q.eq(q.field('sellerId'), identity.subject))
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

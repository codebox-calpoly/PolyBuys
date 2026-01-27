import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { paginationOptsValidator } from 'convex/server';

// Get all profiles
export const getProfiles = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .paginate(args.paginationOpts);
  },
});

// Get user profile by name
export const getProfilebyName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const profiles = await ctx.db
      .query('profiles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .collect();

    if (profiles.length === 0) return null;

    return profiles.map((profile) => ({
      name: profile.name,
      bio: profile.bio,
      picture: profile.picture,
      joinDate: profile.joinDate,
      major: profile.major,
      year: profile.year,
      rating: profile.rating,
      review_count: profile.review_count,
    }));
  },
});

// Create profile
export const createProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    bio: v.optional(v.string()),
    picture: v.optional(v.id('_storage')),
    major: v.string(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('You must be logged in to create a profile');
    }

    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();
    if (existingProfile) {
      throw new Error('Profile already exists for this user');
    }

    const profileId = await ctx.db.insert('profiles', {
      userId: identity.subject,
      joinDate: Date.now(),
      rating: 0,
      review_count: 0,
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
    if (!identity) throw new Error('You must be logged in');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!profile) throw new Error('Profile not found');

    const update: Partial<Doc<'profiles'>> = {};

    if (args.name !== undefined) update.name = args.name;
    if (args.bio !== undefined) update.bio = args.bio;
    if (args.picture !== undefined) update.picture = args.picture;
    if (args.major !== undefined) update.major = args.major;
    if (args.year !== undefined) update.year = args.year;

    if (Object.keys(update).length === 0) {
      throw new Error('No valid fields to update');
    }

    await ctx.db.patch(profile._id, update);
  },
});

// Upload profile picture
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('You must be logged in');
    
    return await ctx.storage.generateUploadUrl();
  },
});
export const setProfilePicture = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('You must be logged in');

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!profile) throw new Error('Profile not found');

    await ctx.db.patch(profile._id, { picture: args.storageId });
  },
});

// View own active listings
export const viewActiveListings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('You must be logged in');
    return await ctx.db
      .query('listings')
      .filter((q) => q.eq(q.field('sellerId'), identity.subject))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect();
  },
});

// View user's rating and review count
export const viewRatingReview = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const ratingReview = await ctx.db
      .query('profiles')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .collect();

    return ratingReview.map((ratingReview) => ({
      rating: ratingReview.rating,
      review_count: ratingReview.review_count,
    }));
  },
});

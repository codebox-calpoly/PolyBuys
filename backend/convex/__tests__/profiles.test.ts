/* eslint-disable @typescript-eslint/no-explicit-any */

import { convexTest } from 'convex-test';
import schema from '../schema';
import { api } from '../_generated/api';
import * as profilesModule from '../profiles';
import * as apiModule from '../_generated/api';
import * as serverModule from '../_generated/server';

const modules = {
  '../profiles.ts': () => Promise.resolve(profilesModule),
  '../_generated/api.ts': () => Promise.resolve(apiModule),
  '../_generated/server.ts': () => Promise.resolve(serverModule),
} as any;

describe('Profiles mutations', () => {
  it('createProfile stores server-derived email', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-stable-id',
      email: 'ALICE@calpoly.edu',
    });

    const profileId = await asUser.mutation(api.profiles.createProfile, {
      name: 'Alice',
      major: 'Computer Science',
      year: 2026,
      bio: 'Test bio',
    });

    const profile = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    expect(profile?.email).toBe('alice@calpoly.edu');
    expect(profile?.userId).toBe('alice-stable-id');
  });

  it('createProfile does not allow duplicate profile for same user (onboarding once)', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-stable-id',
      email: 'alice@calpoly.edu',
    });

    await asUser.mutation(api.profiles.createProfile, {
      name: 'Alice',
      major: 'Computer Science',
      year: 2026,
    });

    await expect(async () => {
      await asUser.mutation(api.profiles.createProfile, {
        name: 'Alice Again',
        major: 'Computer Science',
        year: 2026,
      });
    }).rejects.toThrowError('Profile already exists for this user');
  });

  it('createProfile rejects when no email is provided or available on identity', async () => {
    const t = convexTest(schema as any, modules);
    const asUserWithoutEmail = t.withIdentity({
      name: 'NoEmail',
      subject: 'no-email-id',
    });

    await expect(async () => {
      await asUserWithoutEmail.mutation(api.profiles.createProfile, {
        name: 'No Email User',
        major: 'Computer Science',
        year: 2026,
      });
    }).rejects.toThrowError('Email is required to create a profile');
  });

  it('updateProfile ignores attempts to change the stored email', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-stable-id',
      email: 'alice@calpoly.edu',
    });

    const profileId = await asUser.mutation(api.profiles.createProfile, {
      name: 'Alice',
      major: 'Computer Science',
      year: 2026,
    });

    await asUser.mutation(api.profiles.updateProfile, {
      name: 'Alice Updated',
      email: 'updated@calpoly.edu',
    });

    const profile = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    expect(profile?.name).toBe('Alice Updated');
    expect(profile?.email).toBe('alice@calpoly.edu');
  });

  it('updateProfile ignores reserved server-controlled profile fields', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-stable-id',
      email: 'alice@calpoly.edu',
    });

    const profileId = await asUser.mutation(api.profiles.createProfile, {
      name: 'Alice',
      major: 'Computer Science',
      year: 2026,
    });

    const originalProfile = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    await asUser.mutation(api.profiles.updateProfile, {
      name: 'Alice Updated',
      joinDate: 1,
      rating: 5,
      review_count: 99,
      isHidden: true,
      hiddenAt: 123,
      hiddenReason: 'client should not be able to set this',
    });

    const updatedProfile = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    expect(updatedProfile?.name).toBe('Alice Updated');
    expect(updatedProfile?.joinDate).toBe(originalProfile?.joinDate);
    expect(updatedProfile?.rating).toBe(originalProfile?.rating);
    expect(updatedProfile?.review_count).toBe(originalProfile?.review_count);
    expect(updatedProfile?.isHidden).toBeUndefined();
    expect(updatedProfile?.hiddenAt).toBeUndefined();
    expect(updatedProfile?.hiddenReason).toBeUndefined();
  });

  it('updateProfile rejects reserved-only updates and keeps server-controlled fields unchanged', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-stable-id',
      email: 'alice@calpoly.edu',
    });

    const profileId = await asUser.mutation(api.profiles.createProfile, {
      name: 'Alice',
      major: 'Computer Science',
      year: 2026,
    });

    const profileBefore = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      asUser.mutation(api.profiles.updateProfile, {
        joinDate: Date.now() + 1000,
        rating: 4.5,
        review_count: 12,
        isHidden: true,
        hiddenAt: Date.now() + 2000,
        hiddenReason: 'manual_admin_action',
      })
    ).rejects.toThrowError('No valid fields to update');

    expect(warnSpy).toHaveBeenCalledWith(
      '[profiles.updateProfile] Ignoring reserved fields: joinDate, rating, review_count, isHidden, hiddenAt, hiddenReason'
    );
    warnSpy.mockRestore();

    const profileAfter = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    expect(profileAfter?.joinDate).toBe(profileBefore?.joinDate);
    expect(profileAfter?.rating).toBe(profileBefore?.rating);
    expect(profileAfter?.review_count).toBe(profileBefore?.review_count);
    expect(profileAfter?.isHidden).toBe(profileBefore?.isHidden);
    expect(profileAfter?.hiddenAt).toBe(profileBefore?.hiddenAt);
    expect(profileAfter?.hiddenReason).toBe(profileBefore?.hiddenReason);
  });
});

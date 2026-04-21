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

  it('updateProfile rejects email-only updates and keeps the stored email unchanged', async () => {
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

    await expect(
      asUser.mutation(api.profiles.updateProfile, {
        email: 'updated@calpoly.edu',
      })
    ).rejects.toThrowError('No valid fields to update');

    const profile = await t.run(async (ctx) => {
      return await ctx.db.get(profileId);
    });

    expect(profile?.email).toBe('alice@calpoly.edu');
  });
});

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
      subject: 'alice-id',
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
    expect(profile?.userId).toBe('alice-id');
  });

  it('createProfile rejects users without an authenticated email', async () => {
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
    }).rejects.toThrowError('Authenticated user email is required to create a profile');
  });

  it('createProfile enforces Cal Poly email addresses', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Outside User',
      subject: 'outside-id',
      email: 'outside@gmail.com',
    });

    await expect(async () => {
      await asUser.mutation(api.profiles.createProfile, {
        name: 'Outside User',
        major: 'Computer Science',
        year: 2026,
      });
    }).rejects.toThrowError('Email must be a @calpoly.edu address');
  });

  it('createProfile validates year bounds', async () => {
    const t = convexTest(schema as any, modules);
    const asUser = t.withIdentity({
      name: 'Alice',
      subject: 'alice-year-id',
      email: 'alice@calpoly.edu',
    });

    await expect(async () => {
      await asUser.mutation(api.profiles.createProfile, {
        name: 'Alice',
        major: 'Computer Science',
        year: 1200,
      });
    }).rejects.toThrowError('Year must be between 1900 and 9999');
  });
});

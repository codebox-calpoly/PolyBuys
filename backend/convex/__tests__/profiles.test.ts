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

describe('Profiles pagination hardening', () => {
  it('getProfiles rejects numItems above the maximum bound', async () => {
    const t = convexTest(schema as any, modules);

    await expect(async () => {
      await t.query(api.profiles.getProfiles, {
        paginationOpts: {
          numItems: 101,
          cursor: null,
        },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });

  it('getProfiles rejects numItems below the minimum bound', async () => {
    const t = convexTest(schema as any, modules);

    await expect(async () => {
      await t.query(api.profiles.getProfiles, {
        paginationOpts: {
          numItems: 0,
          cursor: null,
        },
      });
    }).rejects.toThrow('numItems must be between 1 and 100');
  });

  it('getProfiles forwards opaque cursor values to Convex pagination', async () => {
    const t = convexTest(schema as any, modules);

    const result = await t.query(api.profiles.getProfiles, {
      paginationOpts: {
        numItems: 20,
        cursor: 'bad-cursor!',
      },
    });

    expect(result).toMatchObject({
      isDone: true,
      page: [],
    });
    expect(typeof result.continueCursor).toBe('string');
  });
});

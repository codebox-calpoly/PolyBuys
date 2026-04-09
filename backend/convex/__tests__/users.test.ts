/* eslint-disable @typescript-eslint/no-explicit-any */

import { api } from '../_generated/api';
import { createConvexTest, createTestUser } from './testUtils';
import type { Id } from '../_generated/dataModel';

describe('Users queries and mutations', () => {
  describe('getCurrentUser', () => {
    it('returns null when user is not authenticated', async () => {
      const t = createConvexTest();

      const currentUser = await t.query(api.users.getCurrentUser);

      expect(currentUser).toBeNull();
    });

    it('returns null when authenticated user does not exist in users table', async () => {
      const t = createConvexTest();

      // Create identity without database user
      const asUser = t.withIdentity({
        name: 'Ghost',
        subject: 'ghost-id-not-in-db' as Id<'users'>,
        email: 'ghost@calpoly.edu',
      });

      const currentUser = await asUser.query(api.users.getCurrentUser);

      expect(currentUser).toBeNull();
    });

    it('returns user data when authenticated user exists', async () => {
      const t = createConvexTest();

      const alice = await createTestUser(t, 'alice@calpoly.edu', 'Alice Smith');
      const asAlice = t.withIdentity(alice.identity);

      const currentUser = await asAlice.query(api.users.getCurrentUser);

      expect(currentUser).toMatchObject({
        email: 'alice@calpoly.edu',
        name: 'Alice Smith',
        emailVerified: true,
      });
      expect(currentUser?._id).toBe(alice.id);
      expect(currentUser?._creationTime).toBeDefined();
    });

    it('normalizes email to lowercase', async () => {
      const t = createConvexTest();

      // Insert user with mixed-case email
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'ALICE@CALPOLY.EDU',
          name: 'Alice Smith',
          emailVerified: true,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'ALICE@CALPOLY.EDU',
      });

      const currentUser = await asUser.query(api.users.getCurrentUser);

      expect(currentUser?.email).toBe('alice@calpoly.edu');
    });

    it('returns null when user email is missing', async () => {
      const t = createConvexTest();

      // Insert user without email
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          name: 'Alice Smith',
          emailVerified: true,
          createdAt: Date.now(),
        } as any);
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'alice@calpoly.edu',
      });

      const currentUser = await asUser.query(api.users.getCurrentUser);

      expect(currentUser).toBeNull();
    });

    it('uses emailVerified field', async () => {
      const t = createConvexTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'alice@calpoly.edu',
          name: 'Alice Smith',
          emailVerified: true,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'alice@calpoly.edu',
      });

      const currentUser = await asUser.query(api.users.getCurrentUser);

      expect(currentUser?.emailVerified).toBe(true);
    });
  });

  describe('updateUserProfile', () => {
    it('throws error when user is not authenticated', async () => {
      const t = createConvexTest();

      await expect(async () => {
        await t.mutation(api.users.updateUserProfile, { name: 'New Name' });
      }).rejects.toThrow('Not authenticated');
    });

    it('throws error when authenticated user does not exist', async () => {
      const t = createConvexTest();

      const asUser = t.withIdentity({
        name: 'Ghost',
        subject: 'ghost-id-not-in-db' as Id<'users'>,
        email: 'ghost@calpoly.edu',
      });

      await expect(async () => {
        await asUser.mutation(api.users.updateUserProfile, { name: 'New Name' });
      }).rejects.toThrow('User not found');
    });

    it('updates user name successfully', async () => {
      const t = createConvexTest();

      const alice = await createTestUser(t, 'alice@calpoly.edu', 'Alice');
      const asAlice = t.withIdentity(alice.identity);

      const updatedUser = await asAlice.mutation(api.users.updateUserProfile, {
        name: 'Alice Smith',
      });

      expect(updatedUser.name).toBe('Alice Smith');
      expect(updatedUser.email).toBe('alice@calpoly.edu');

      // Verify in database
      const userInDb = await t.run(async (ctx) => {
        return await ctx.db.get(alice.id);
      });

      expect(userInDb?.name).toBe('Alice Smith');
    });

    it('can set name to null', async () => {
      const t = createConvexTest();

      const alice = await createTestUser(t, 'alice@calpoly.edu', 'Alice Smith');
      const asAlice = t.withIdentity(alice.identity);

      const updatedUser = await asAlice.mutation(api.users.updateUserProfile, {
        name: null,
      });

      expect(updatedUser.name).toBeNull();
    });

    it('preserves email normalization during update', async () => {
      const t = createConvexTest();

      // Insert user with mixed-case email
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'ALICE@CALPOLY.EDU',
          name: 'Alice',
          emailVerified: true,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'ALICE@CALPOLY.EDU',
      });

      const updatedUser = await asUser.mutation(api.users.updateUserProfile, {
        name: 'Alice Smith',
      });

      expect(updatedUser.email).toBe('alice@calpoly.edu');
    });

    it('preserves createdAt during update', async () => {
      const t = createConvexTest();

      const createdAt = Date.now() - 1000000;
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'alice@calpoly.edu',
          name: 'Alice',
          emailVerified: true,
          createdAt,
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'alice@calpoly.edu',
      });

      await asUser.mutation(api.users.updateUserProfile, {
        name: 'Alice Smith',
      });

      const userInDb = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(userInDb?.createdAt).toBe(createdAt);
    });
  });

  describe('getOrCreateUser', () => {
    it('throws error when user is not authenticated', async () => {
      const t = createConvexTest();

      await expect(async () => {
        await t.mutation(api.users.getOrCreateUser);
      }).rejects.toThrow('Not authenticated');
    });

    it('throws error when authenticated user does not exist', async () => {
      const t = createConvexTest();

      const asUser = t.withIdentity({
        name: 'Ghost',
        subject: 'ghost-id-not-in-db' as Id<'users'>,
        email: 'ghost@calpoly.edu',
      });

      await expect(async () => {
        await asUser.mutation(api.users.getOrCreateUser);
      }).rejects.toThrow('Auth user not found');
    });

    it('normalizes and returns existing user', async () => {
      const t = createConvexTest();

      const createdAt = Date.now() - 1000000;
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'ALICE@calpoly.edu',
          name: 'Alice',
          createdAt,
          emailVerified: true,
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'ALICE@calpoly.edu',
      });

      const user = await asUser.mutation(api.users.getOrCreateUser);

      expect(user.email).toBe('alice@calpoly.edu');
      expect(user.name).toBe('Alice');
      expect(user.emailVerified).toBe(true);
      expect(user.createdAt).toBe(createdAt);
    });

    it('ensures email is normalized to lowercase', async () => {
      const t = createConvexTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'ALICE@CALPOLY.EDU',
          name: 'Alice',
          emailVerified: true,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'ALICE@CALPOLY.EDU',
      });

      const user = await asUser.mutation(api.users.getOrCreateUser);

      expect(user.email).toBe('alice@calpoly.edu');
    });

    it('handles user with null name', async () => {
      const t = createConvexTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'alice@calpoly.edu',
          emailVerified: true,
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'alice@calpoly.edu',
      });

      const user = await asUser.mutation(api.users.getOrCreateUser);

      expect(user.name).toBeNull();
      expect(user.email).toBe('alice@calpoly.edu');
    });

    it('uses _creationTime as fallback for createdAt', async () => {
      const t = createConvexTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert('users', {
          email: 'alice@calpoly.edu',
          name: 'Alice',
          emailVerified: true,
          // No createdAt provided
        });
      });

      const asUser = t.withIdentity({
        name: 'Alice',
        subject: userId,
        email: 'alice@calpoly.edu',
      });

      const user = await asUser.mutation(api.users.getOrCreateUser);

      expect(user.createdAt).toBeDefined();
      expect(user.createdAt).toBe(user._creationTime);
    });
  });

  describe('edge cases and data integrity', () => {
    it('handles multiple users with different emails', async () => {
      const t = createConvexTest();

      const alice = await createTestUser(t, 'alice@calpoly.edu', 'Alice');
      const bob = await createTestUser(t, 'bob@calpoly.edu', 'Bob');

      // Verify users exist by getting their profiles
      const asAlice = t.withIdentity(alice.identity);
      const asBob = t.withIdentity(bob.identity);

      const aliceData = await asAlice.query(api.users.getCurrentUser);
      const bobData = await asBob.query(api.users.getCurrentUser);

      expect(aliceData?.email).toBe('alice@calpoly.edu');
      expect(bobData?.email).toBe('bob@calpoly.edu');
    });

    it('getCurrentUser returns correct user for different authenticated identities', async () => {
      const t = createConvexTest();

      const alice = await createTestUser(t, 'alice@calpoly.edu', 'Alice');
      const bob = await createTestUser(t, 'bob@calpoly.edu', 'Bob');

      const asAlice = t.withIdentity(alice.identity);
      const asBob = t.withIdentity(bob.identity);

      const aliceData = await asAlice.query(api.users.getCurrentUser);
      const bobData = await asBob.query(api.users.getCurrentUser);

      expect(aliceData?.email).toBe('alice@calpoly.edu');
      expect(aliceData?.name).toBe('Alice');
      expect(bobData?.email).toBe('bob@calpoly.edu');
      expect(bobData?.name).toBe('Bob');
    });
  });
});

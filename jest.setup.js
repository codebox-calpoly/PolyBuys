/* eslint-env jest */
// Jest setup file for mocking external dependencies

// Mock @convex-dev/auth/server
jest.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: jest.fn(async (ctx) => {
    // In tests, the identity.subject is already the user ID
    const identity = await ctx.auth.getUserIdentity();
    return identity ? identity.subject : null;
  }),
  convexAuth: jest.fn(() => ({
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    store: jest.fn(),
    isAuthenticated: jest.fn(),
  })),
}));

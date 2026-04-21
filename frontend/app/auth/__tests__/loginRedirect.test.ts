import { describe, expect, it } from '@jest/globals';
import { getLoginEntryAction } from '../../../lib/auth/loginRedirect';

describe('getLoginEntryAction', () => {
  it('keeps waiting while the profile query is unresolved', () => {
    expect(
      getLoginEntryAction({
        isSessionLoading: false,
        isAuthenticated: true,
        currentProfile: undefined,
        step: 'welcome',
      })
    ).toBeNull();
  });

  it('redirects authenticated users with a profile back into the app', () => {
    expect(
      getLoginEntryAction({
        isSessionLoading: false,
        isAuthenticated: true,
        currentProfile: { _id: 'profile_1' },
        step: 'email',
      })
    ).toBe('post-auth-redirect');
  });

  it('advances authenticated users without a profile into onboarding', () => {
    expect(
      getLoginEntryAction({
        isSessionLoading: false,
        isAuthenticated: true,
        currentProfile: null,
        step: 'welcome',
      })
    ).toBe('profile');
  });
});

import {
  SIGNED_IN_NATIVE_TABS,
  SIGNED_OUT_NATIVE_TABS,
  getSignedOutFallback,
  getVisibleNativeTabs,
} from '../guestAccess';

describe('guestAccess', () => {
  it('returns browse-only tabs for signed-out users', () => {
    expect(getVisibleNativeTabs(false)).toEqual(SIGNED_OUT_NATIVE_TABS);
  });

  it('returns all native tabs for signed-in users', () => {
    expect(getVisibleNativeTabs(true)).toEqual(SIGNED_IN_NATIVE_TABS);
  });

  it('redirects protected account routes back to home when signed out', () => {
    expect(getSignedOutFallback('/my-listings')).toBe('/home');
    expect(getSignedOutFallback('/inbox')).toBe('/home');
    expect(getSignedOutFallback('/settings')).toBe('/home');
    expect(getSignedOutFallback('/account-settings')).toBe('/home');
  });

  it('leaves public browse routes accessible', () => {
    expect(getSignedOutFallback('/home')).toBeNull();
    expect(getSignedOutFallback('/search')).toBeNull();
    expect(getSignedOutFallback('/listings/abc123')).toBeNull();
  });
});

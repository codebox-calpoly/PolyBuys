export const SIGNED_OUT_NATIVE_TABS = ['home', 'search'] as const;

export const SIGNED_IN_NATIVE_TABS = [
  'home',
  'search',
  'my-listings',
  'inbox',
  'settings',
] as const;

const SIGNED_OUT_FALLBACK_ROUTES = new Set([
  '/my-listings',
  '/inbox',
  '/settings',
  '/account-settings',
]);

export type NativeTabName = (typeof SIGNED_IN_NATIVE_TABS)[number];

export function getVisibleNativeTabs(isAuthenticated: boolean): readonly NativeTabName[] {
  return isAuthenticated ? SIGNED_IN_NATIVE_TABS : SIGNED_OUT_NATIVE_TABS;
}

export function getSignedOutFallback(pathname: string): '/home' | null {
  return SIGNED_OUT_FALLBACK_ROUTES.has(pathname) ? '/home' : null;
}

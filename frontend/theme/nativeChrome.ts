import { colors } from './tokens';

// Light-only blur/chrome (see app.json userInterfaceStyle + root ThemeProvider).

const LIGHT_BLUR_TINT = 'systemThinMaterialLight' as const;

export type AppBlurTint = typeof LIGHT_BLUR_TINT;
export type AppKeyboardAppearance = 'light';

export const nativeChrome = {
  blurTint: LIGHT_BLUR_TINT,
  tabBarBlurEffect: LIGHT_BLUR_TINT,
  tabBarBackgroundColor: colors.surface,
  tabBarShadowColor: 'rgba(21, 71, 52, 0.14)',
  tabLabelDefaultColor: colors.text,
  tabLabelSelectedColor: colors.primary,
  tabIconDefaultColor: colors.text,
  tabIconSelectedColor: colors.primary,
  keyboardAppearance: 'light' as AppKeyboardAppearance,
} as const;

export type SearchFieldChrome = {
  keyboardAppearance: AppKeyboardAppearance;
  blurTint: AppBlurTint;
  barTintColor: string;
  textColor: string;
  hintTextColor: string;
  iconColor: string;
  searchBarWrapBackground: string;
  searchBarWrapBorder: string;
  clearButtonBackground: string;
};

export function searchFieldChrome(): SearchFieldChrome {
  return {
    keyboardAppearance: nativeChrome.keyboardAppearance,
    blurTint: nativeChrome.blurTint,
    barTintColor: nativeChrome.tabBarBackgroundColor,
    textColor: colors.textDark,
    hintTextColor: colors.muted,
    iconColor: colors.textDark,
    searchBarWrapBackground: 'rgba(255, 255, 255, 0.45)',
    searchBarWrapBorder: 'rgba(255, 255, 255, 0.6)',
    clearButtonBackground: 'rgba(0, 0, 0, 0.15)',
  };
}

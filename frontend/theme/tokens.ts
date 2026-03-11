/**
 * PolyBuys design tokens derived from Figma.
 * See frontend/docs/figma-node-mapping.md for source mapping.
 */

export const colors = {
  /** Primary brand green - header, nav, primary buttons */
  primary: '#154734',
  /** Light page background */
  background: '#E8FCEF',
  /** Accent - prices, highlights */
  accent: '#E2A84A',
  /** Card/content surfaces */
  surface: '#F9FFFD',
  /** Body text */
  text: '#4A4A48',
  /** Dark headings */
  textDark: '#1E1E1E',
  /** Secondary borders, dividers */
  border: '#D9EBE4',
  /** Seller block, location chip background */
  muted: '#8DB1A3',
  /** Category chip (e.g. Housing) */
  category: '#FF6E5E',
  /** Location chip background */
  location: '#ACDDCA',
  /** White for content areas */
  white: '#FFFFFF',
  /** Light green for inactive nav */
  navInactive: '#D9EBE4',
  /** Info banner (web app prompt) */
  infoBg: '#e8f4ff',
  infoBorder: '#cae3ff',
  infoText: '#1f4e80',
  infoButton: '#1f6fb2',
  /** Error/destructive states */
  errorBg: '#fff0f0',
  errorBorder: '#f6cdcd',
  errorText: '#ad2020',
  destructive: '#b3261e',
  /** Neutral grays for placeholders, secondary text */
  gray: '#666666',
  grayLight: '#eaeaea',
  /** Shadow */
  shadow: '#000000',
  /** Warning/alert banner (e.g. hidden listing) */
  warningBg: '#fff9eb',
  warningBorder: '#f0d37a',
  warningText: '#6c4f20',
  warningLink: '#8a5a00',
  /** Placeholder/empty state surfaces */
  placeholderBg: '#f3f7f5',
  placeholderBorder: '#d8e6df',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  /** Poppins Bold 22px - titles */
  title1: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: 0.22,
  },
  /** Poppins Bold 19px - price, emphasis */
  title2: {
    fontFamily: 'System',
    fontSize: 19,
    fontWeight: '700' as const,
    lineHeight: 22,
    letterSpacing: 0.19,
  },
  /** Inter SemiBold 17px */
  heading: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: 0.17,
  },
  /** Inter Regular 17px */
  body: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: 0.17,
  },
  /** Inter Regular 15px */
  subhead: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  /** Inter Regular 13px */
  footnote: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 0.13,
  },
  /** Inter Medium 13px */
  footnoteMed: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.13,
  },
} as const;

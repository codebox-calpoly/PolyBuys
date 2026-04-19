/**
 * PolyBuys design tokens derived from Figma.
 * See frontend/docs/figma-node-mapping.md for source mapping.
 */

export const colors = {
  /** Primary brand green - header, nav, primary buttons */
  primary: '#0E6B53',
  /** Light page background */
  background: '#F2FBF4',
  /** Accent - prices, highlights */
  accent: '#F4A62A',
  /** Card/content surfaces */
  surface: '#FBFFFD',
  /** Brand-tinted surface for hero sections */
  surfaceBrand: '#E3F7ED',
  /** Warm surface for supportive secondary sections */
  surfaceWarm: '#FFF4E1',
  /** Soft coral tint for alerts and visual punctuation */
  surfaceCoral: '#FFE9E3',
  /** Body text */
  text: '#41514A',
  /** Dark headings */
  textDark: '#11261F',
  /** Secondary borders, dividers */
  border: '#CCE7DB',
  /** Seller block, location chip background */
  muted: '#739788',
  /** Category chip (e.g. Housing) */
  category: '#FF715B',
  /** Location chip background */
  location: '#C5F0D7',
  /** White for content areas */
  white: '#FFFFFF',
  /** Light green for inactive nav */
  navInactive: '#C4E5D7',
  /** Info banner (web app prompt) */
  infoBg: '#E6F5FF',
  infoBorder: '#B8DFFF',
  infoText: '#17537F',
  infoButton: '#1178C8',
  /** Error/destructive states */
  errorBg: '#FFF1F0',
  errorBorder: '#F7C7C2',
  errorText: '#B93024',
  destructive: '#C0392B',
  /** Neutral grays for placeholders, secondary text */
  gray: '#66756E',
  grayLight: '#E7EFEA',
  /** Shadow */
  shadow: '#000000',
  /** Warning/alert banner (e.g. hidden listing) */
  warningBg: '#FFF4DD',
  warningBorder: '#F2C66B',
  warningText: '#7A4D12',
  warningTextMuted: '#9A6C1F',
  warningLink: '#A25D00',
  locationDark: '#1E8A67',
  overlayLight: 'rgba(14, 107, 83, 0.12)',
  /** Placeholder/empty state surfaces */
  placeholderBg: '#EEF7F2',
  placeholderBorder: '#D4E5DD',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  /** Between sm and md — compact card gutters */
  smPlus: 10,
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

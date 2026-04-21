import { APP_STORE_URL } from '../../constants/app';
import qrDownloadPng from '../../assets/images/polybuys-download-qr.png';

/** Official App Store badge artwork (Apple Marketing Resources). */
export const APP_STORE_BADGE_URI =
  'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83';

export { APP_STORE_URL };

/** Metro resolves PNG imports differently per environment. Normalise to a URL string. */
export const QR_SRC =
  typeof qrDownloadPng === 'string'
    ? qrDownloadPng
    : ((qrDownloadPng as { uri?: string; default?: string }).uri ??
      (qrDownloadPng as unknown as { default: string }).default ??
      '');

export type SampleListing = {
  title: string;
  category: string;
  price: string;
  seller: string;
  location: string;
  emoji: string;
  gradient: string;
  badge?: string;
};

/** Just the two cards rendered in the hero stage. */
export const HERO_LISTINGS: readonly [SampleListing, SampleListing] = [
  {
    title: 'Calculus: Early Transcendentals, 8e',
    category: 'Textbooks',
    price: '$40',
    seller: 'Hazel',
    location: 'Poly Canyon',
    emoji: '📚',
    gradient: 'linear-gradient(135deg, #1E5C44 0%, #154734 100%)',
    badge: 'Just listed',
  },
  {
    title: 'IKEA Kallax 4-cube shelf',
    category: 'Furniture',
    price: '$35',
    seller: 'Mateo',
    location: 'Mustang Village',
    emoji: '🗄️',
    gradient: 'linear-gradient(135deg, #F3D38B 0%, #E2A84A 100%)',
  },
];

export type ValuePoint = {
  title: string;
  body: string;
  icon: string;
};

export const VALUE_POINTS: readonly ValuePoint[] = [
  {
    title: 'Students only',
    body: 'Cal Poly email sign-in runs in the iOS app so listings stay in the campus community.',
    icon: '🎓',
  },
  {
    title: 'Built for how you actually buy',
    body: 'Textbooks, housing, furniture, and everyday gear — organized for quick browsing and search.',
    icon: '🔍',
  },
  {
    title: 'Campus-first trust',
    body: 'Clear seller profiles and in-app messaging help you coordinate pickups without giving out extra contact info.',
    icon: '🤝',
  },
];

export type TickerItem = { emoji: string; label: string };

export const TICKER_ITEMS: readonly TickerItem[] = [
  { emoji: '📚', label: 'Textbooks' },
  { emoji: '🚲', label: 'Bikes' },
  { emoji: '🛋️', label: 'Furniture' },
  { emoji: '🏠', label: 'Subleases' },
  { emoji: '🎒', label: 'Backpacks' },
  { emoji: '🧊', label: 'Mini fridges' },
  { emoji: '🖥️', label: 'Desks' },
  { emoji: '🚗', label: 'Parking passes' },
  { emoji: '🪴', label: 'Plants' },
  { emoji: '🎸', label: 'Instruments' },
];

export type AvatarEntry = { initial: string; bg: string };

export const AVATAR_STACK: readonly AvatarEntry[] = [
  { initial: 'H', bg: '#1E5C44' },
  { initial: 'M', bg: '#E2A84A' },
  { initial: 'P', bg: '#FF6E5E' },
  { initial: 'A', bg: '#2B7A5A' },
  { initial: 'C', bg: '#A48BD1' },
];

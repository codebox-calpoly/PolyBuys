import { APP_STORE_URL } from '../../constants/app';
import qrDownloadPng from '../../assets/images/polybuys-download-qr.png';
import { PRODUCT_IMAGES } from './productImages';

export { APP_STORE_URL };

type QrAsset = string | { uri?: string; default?: string };
const qrAsset = qrDownloadPng as QrAsset;
export const QR_SRC =
  typeof qrAsset === 'string' ? qrAsset : (qrAsset.uri ?? qrAsset.default ?? '');

export type ListingThumbIconId = 'textbook' | 'furniture';

export type WhyIconId = 'students' | 'browse' | 'trust';

export type SampleListing = {
  title: string;
  category: string;
  price: string;
  seller: string;
  location: string;
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  gradient: string;
  badge?: string;
};

export const HERO_LISTINGS: readonly [SampleListing, SampleListing] = [
  {
    title: 'Calculus: Early Transcendentals, 8e',
    category: 'Textbooks',
    price: '$40',
    seller: 'Hazel',
    location: 'Poly Canyon',
    image: {
      src: PRODUCT_IMAGES.calculusBook,
      alt: 'Used maroon calculus textbook with a mathematical diagram on a desk',
      width: 640,
      height: 400,
    },
    gradient: 'linear-gradient(135deg, #1E5C44 0%, #154734 100%)',
    badge: 'Just listed',
  },
  {
    title: 'IKEA Kallax 4-cube shelf',
    category: 'Furniture',
    price: '$35',
    seller: 'Mateo',
    location: 'Mustang Village',
    image: {
      src: PRODUCT_IMAGES.cubeShelf,
      alt: 'White four-cube shelf with books and woven baskets in a living room',
      width: 640,
      height: 400,
    },
    gradient: 'linear-gradient(135deg, #F3D38B 0%, #E2A84A 100%)',
  },
];

export type ValuePoint = {
  title: string;
  body: string;
  icon: WhyIconId;
};

export const VALUE_POINTS: readonly ValuePoint[] = [
  {
    title: 'Students only',
    body: 'Cal Poly email sign-in runs in the iOS app so listings stay in the campus community.',
    icon: 'students',
  },
  {
    title: 'Built for how you actually buy',
    body: 'Textbooks, housing, furniture, and everyday gear — organized for quick browsing and search.',
    icon: 'browse',
  },
  {
    title: 'Campus-first trust',
    body: 'Clear seller profiles and in-app messaging help you coordinate pickups without giving out extra contact info.',
    icon: 'trust',
  },
];

export type TickerCategoryId =
  | 'textbooks'
  | 'bikes'
  | 'furniture'
  | 'subleases'
  | 'backpacks'
  | 'miniFridges'
  | 'desks'
  | 'parking'
  | 'plants'
  | 'instruments';

export type TickerItem = { id: TickerCategoryId; label: string };

export const TICKER_ITEMS: readonly TickerItem[] = [
  { id: 'textbooks', label: 'Textbooks' },
  { id: 'bikes', label: 'Bikes' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'subleases', label: 'Subleases' },
  { id: 'backpacks', label: 'Backpacks' },
  { id: 'miniFridges', label: 'Mini fridges' },
  { id: 'desks', label: 'Desks' },
  { id: 'parking', label: 'Parking passes' },
  { id: 'plants', label: 'Plants' },
  { id: 'instruments', label: 'Instruments' },
];

export type AvatarEntry = { initial: string; bg: string };

export const AVATAR_STACK: readonly AvatarEntry[] = [
  { initial: 'H', bg: '#1E5C44' },
  { initial: 'M', bg: '#E2A84A' },
  { initial: 'P', bg: '#FF6E5E' },
  { initial: 'A', bg: '#2B7A5A' },
  { initial: 'C', bg: '#A48BD1' },
];

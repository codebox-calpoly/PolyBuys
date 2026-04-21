/**
 * Public mobile-app entry URL used by the QR on the marketing page, the App Store badge,
 * and download/share prompts.
 * If you change it, regenerate `assets/images/polybuys-download-qr.png`
 * so the encoded payload matches (e.g. `npx qrcode "<url>" -o frontend/assets/images/polybuys-download-qr.png -w 440`).
 */
export const APP_STORE_URL = 'https://poly-buys.vercel.app';

export const APP_SCHEME = 'polybuys';

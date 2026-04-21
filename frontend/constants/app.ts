/**
 * Public mobile-app entry URL used by the QR on the marketing page, the install CTA,
 * and download/share prompts.
 * If you change it, regenerate `assets/images/polybuys-download-qr.png`
 * so the encoded payload matches (e.g. `npx qrcode "<url>" -o frontend/assets/images/polybuys-download-qr.png -w 440`).
 */
export const APP_STORE_URL = 'https://testflight.apple.com/join/1BJ37S43';

export const APP_SCHEME = 'polybuys';

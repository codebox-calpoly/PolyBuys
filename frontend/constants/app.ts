/**
 * Public download / App Store entry URL (QR on the marketing page, badge, mailto body).
 * Before shipping broadly: ensure this URL 301/302s to the real App Store listing or serves
 * a reliable interstitial. If you change it, regenerate `assets/images/polybuys-download-qr.png`
 * so the encoded payload matches (e.g. `npx qrcode "<url>" -o frontend/assets/images/polybuys-download-qr.png -w 440`).
 */
export const APP_STORE_URL = 'https://polybuys.com/download';

export const APP_SCHEME = 'polybuys';

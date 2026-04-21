import { APP_STORE_URL } from './data';

/** Open the user's mail client with a pre-filled download link. */
export function openDownloadLinkEmail(): void {
  const subject = encodeURIComponent('PolyBuys — download link');
  const body = encodeURIComponent(
    `Here's the link to get PolyBuys:\n\n${APP_STORE_URL}\n\nOpen it on your phone to install or download.\n`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

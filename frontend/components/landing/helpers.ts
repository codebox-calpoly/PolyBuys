import { APP_STORE_URL } from './data';

export function openDownloadLinkEmail(): void {
  const subject = encodeURIComponent('PolyBuys — download link');
  const body = encodeURIComponent(
    `Here's the link to get PolyBuys:\n\n${APP_STORE_URL}\n\nOpen it on your phone to install or download.\n`
  );
  const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
  const a = document.createElement('a');
  a.href = mailtoUrl;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

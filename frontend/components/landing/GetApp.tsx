import { Button } from './Button';
import { DownloadButton } from './DownloadButton';
import { Eyebrow } from './Eyebrow';
import { openDownloadLinkEmail } from './helpers';

export function GetApp() {
  return (
    <section id="get-app" className="pb-section pb-getapp" aria-labelledby="getapp-title">
      <div className="pb-getapp__panel">
        <div className="pb-getapp__text">
          <Eyebrow tone="onDark" as="p">
            Get the app
          </Eyebrow>
          <h2 id="getapp-title" className="pb-getapp__title">
            Browse on the web. Trade in the app.
          </h2>
          <p className="pb-getapp__sub">
            Browse listings here anytime. On iOS you can post, message buyers and sellers, and sign
            in with your Cal Poly email — Mustangs only, like the rest of PolyBuys.
          </p>

          <div className="pb-getapp__ctas">
            <DownloadButton size="lg" variant="cream" />
            <Button variant="ghostOnDark" size="md" onClick={openDownloadLinkEmail}>
              Email me the link
            </Button>
          </div>

          <p className="pb-getapp__footnote">
            Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other
            countries.
          </p>
        </div>
      </div>
    </section>
  );
}

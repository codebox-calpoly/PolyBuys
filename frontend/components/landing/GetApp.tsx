import { Button } from './Button';
import { DownloadButton } from './DownloadButton';
import { Eyebrow } from './Eyebrow';
import { cx } from './cx';
import { openDownloadLinkEmail } from './helpers';
import { useRevealOnVisible } from './useRevealOnVisible';

export function GetApp() {
  const { ref, visible } = useRevealOnVisible<HTMLElement>();

  return (
    <section
      ref={ref}
      id="get-app"
      className={cx('pb-section pb-getapp pb-reveal', visible && 'pb-reveal--visible')}
      aria-labelledby="getapp-title"
    >
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
            TestFlight is Apple&apos;s beta distribution platform for iOS apps.
          </p>
        </div>
      </div>
    </section>
  );
}

import type { MouseEvent } from 'react';
import { Brand } from './Brand';
import { DownloadButton } from './DownloadButton';
import { cx } from './cx';
import { scrollToLandingSection, type LandingSectionId } from './scrollToLandingSection';

interface NavProps {
  scrolled: boolean;
}

export function Nav({ scrolled }: NavProps) {
  function handleSectionClick(event: MouseEvent<HTMLAnchorElement>, sectionId: LandingSectionId) {
    event.preventDefault();
    scrollToLandingSection(sectionId);
  }

  return (
    <div className={cx('pb-nav', scrolled && 'is-scrolled')}>
      <div className="pb-nav__inner">
        <Brand href="/home" ariaLabel="PolyBuys home" />

        <nav className="pb-nav__links" aria-label="Primary">
          <a
            href="#why"
            className="pb-nav__link"
            onClick={(event) => handleSectionClick(event, 'why')}
          >
            Why PolyBuys
          </a>
          <a
            href="#get-app"
            className="pb-nav__link"
            onClick={(event) => handleSectionClick(event, 'get-app')}
          >
            Get the app
          </a>
        </nav>

        <div className="pb-nav__cta">
          <DownloadButton size="sm" variant="primary" label="Download the app" />
        </div>
      </div>
    </div>
  );
}

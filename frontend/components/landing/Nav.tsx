import { Brand } from './Brand';
import { DownloadButton } from './DownloadButton';
import { cx } from './cx';

interface NavProps {
  scrolled: boolean;
}

export function Nav({ scrolled }: NavProps) {
  return (
    <div className={cx('pb-nav', scrolled && 'is-scrolled')}>
      <div className="pb-nav__inner">
        <Brand href="/home" ariaLabel="PolyBuys home" />

        <nav className="pb-nav__links" aria-label="Primary">
          <a href="#why" className="pb-nav__link">
            Why PolyBuys
          </a>
          <a href="#get-app" className="pb-nav__link">
            Get the app
          </a>
        </nav>

        <div className="pb-nav__cta">
          <DownloadButton size="sm" variant="primary" />
        </div>
      </div>
    </div>
  );
}

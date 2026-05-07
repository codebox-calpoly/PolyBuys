import polybuysLogo from '../../assets/images/PolyBuysLogo.png';
import { toWebImageSrc } from './assetSource';
import { cx } from './cx';

interface BrandProps {
  muted?: boolean;
  href?: string;
  ariaLabel?: string;
  className?: string;
}

export function Brand({ muted = false, href, ariaLabel, className }: BrandProps) {
  const classes = cx('pb-brand', muted && 'pb-brand--muted', className);
  const logoSrc = toWebImageSrc(polybuysLogo);
  const content = (
    <img
      src={logoSrc}
      alt="PolyBuys logo"
      className="pb-brand__logo"
      width={716}
      height={158}
      decoding="async"
    />
  );

  if (href) {
    return (
      <a href={href} className={classes} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }
  return <span className={classes}>{content}</span>;
}

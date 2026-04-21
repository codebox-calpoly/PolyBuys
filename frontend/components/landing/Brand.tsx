import { cx } from './cx';

interface BrandProps {
  muted?: boolean;
  href?: string;
  ariaLabel?: string;
  className?: string;
}

export function Brand({ muted = false, href, ariaLabel, className }: BrandProps) {
  const classes = cx('pb-brand', muted && 'pb-brand--muted', className);
  const content = (
    <>
      <span className="pb-brand__mark" aria-hidden>
        <span className="pb-brand__dot" />
      </span>
      <span className="pb-brand__word">PolyBuys</span>
    </>
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

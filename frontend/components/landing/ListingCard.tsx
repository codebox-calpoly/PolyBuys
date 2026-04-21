import type { SampleListing } from './data';
import { cx } from './cx';

type CardVariant = 'back' | 'front';

interface ListingCardProps {
  listing: SampleListing;
  /** Controls the tilt / stacking position of the card in the hero stage. */
  variant: CardVariant;
  className?: string;
}

/** Compact preview card used in the hero stage to showcase marketplace listings. */
export function ListingCard({ listing, variant, className }: ListingCardProps) {
  return (
    <article className={cx('pb-preview', `pb-preview--${variant}`, className)}>
      <div className="pb-preview__thumb" style={{ background: listing.gradient }}>
        <span className="pb-preview__emoji">{listing.emoji}</span>
        {listing.badge ? <span className="pb-preview__badge">{listing.badge}</span> : null}
      </div>
      <div className="pb-preview__body">
        <span className="pb-chip">{listing.category}</span>
        <h3 className="pb-preview__title">{listing.title}</h3>
        <div className="pb-preview__foot">
          <span className="pb-preview__price">{listing.price}</span>
          <span className="pb-preview__seller">· {listing.seller}</span>
        </div>
      </div>
    </article>
  );
}

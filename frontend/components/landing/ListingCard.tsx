import type { SampleListing } from './data';
import { cx } from './cx';

type CardVariant = 'back' | 'front';

interface ListingCardProps {
  listing: SampleListing;
  variant: CardVariant;
  className?: string;
}

export function ListingCard({ listing, variant, className }: ListingCardProps) {
  return (
    <article className={cx('pb-preview', `pb-preview--${variant}`, className)}>
      <div className="pb-preview__thumb" style={{ background: listing.gradient }}>
        <img
          src={listing.image.src}
          alt={listing.image.alt}
          className="pb-preview__image"
          width={listing.image.width}
          height={listing.image.height}
          loading="eager"
          decoding="async"
        />
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

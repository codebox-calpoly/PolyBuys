import type { ReactNode } from 'react';
import { Eyebrow, type EyebrowTone } from './Eyebrow';
import { cx } from './cx';

interface SectionHeadProps {
  eyebrow: ReactNode;
  eyebrowTone?: EyebrowTone;
  /** Accepts rich content so callers can embed `<em>` accents. */
  title: ReactNode;
  /** Optional `id` for the heading, used to wire `aria-labelledby` on the parent section. */
  titleId?: string;
  subtitle?: ReactNode;
  className?: string;
}

export function SectionHead({
  eyebrow,
  eyebrowTone = 'muted',
  title,
  titleId,
  subtitle,
  className,
}: SectionHeadProps) {
  return (
    <div className={cx('pb-section__head', className)}>
      <Eyebrow tone={eyebrowTone} as="p">
        {eyebrow}
      </Eyebrow>
      <h2 id={titleId} className="pb-section__title">
        {title}
      </h2>
      {subtitle ? <p className="pb-section__sub">{subtitle}</p> : null}
    </div>
  );
}

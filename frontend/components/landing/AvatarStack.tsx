import type { AvatarEntry } from './data';
import { cx } from './cx';

interface AvatarStackProps {
  items: readonly AvatarEntry[];
  className?: string;
}

export function AvatarStack({ items, className }: AvatarStackProps) {
  return (
    <div className={cx('pb-proof__avatars', className)} aria-hidden>
      {items.map((a, i) => (
        <span
          key={a.initial}
          className="pb-proof__avatar"
          style={{ background: a.bg, zIndex: items.length - i }}
        >
          {a.initial}
        </span>
      ))}
    </div>
  );
}

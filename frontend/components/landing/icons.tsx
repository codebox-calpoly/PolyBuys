import type { ReactNode } from 'react';
import type { ListingThumbIconId, TickerCategoryId, WhyIconId } from './data';
import { cx } from './cx';

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({
  size,
  className,
  children,
  viewBox = '0 0 24 24',
}: {
  size: number;
  className?: string;
  children: ReactNode;
  viewBox?: string;
}) {
  return (
    <svg
      className={cx('pb-icon', className)}
      width={size}
      height={size}
      viewBox={viewBox}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function TickerIcon({ id, size = 18 }: { id: TickerCategoryId; size?: number }) {
  switch (id) {
    case 'textbooks':
      return (
        <Svg size={size}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...stroke} />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" {...stroke} />
          <path d="M8 7h8M8 11h6" {...stroke} />
        </Svg>
      );
    case 'bikes':
      return (
        <Svg size={size}>
          <circle cx="5.5" cy="17.5" r="3.5" {...stroke} />
          <circle cx="18.5" cy="17.5" r="3.5" {...stroke} />
          <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" {...stroke} />
          <path d="M15 6h2.5l1.5 4M15 6l-3 11.5M9 6.5h3.5" {...stroke} />
        </Svg>
      );
    case 'furniture':
      return (
        <Svg size={size}>
          <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" {...stroke} />
          <path
            d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v0a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v0a2 2 0 0 0-4 0z"
            {...stroke}
          />
          <path d="M4 18v2M20 18v2" {...stroke} />
        </Svg>
      );
    case 'subleases':
      return (
        <Svg size={size}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...stroke} />
          <path d="M9 22V12h6v10" {...stroke} />
        </Svg>
      );
    case 'backpacks':
      return (
        <Svg size={size}>
          <path d="M4 10v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10" {...stroke} />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" {...stroke} />
          <path d="M8 14h8M9 18h6" {...stroke} />
        </Svg>
      );
    case 'miniFridges':
      return (
        <Svg size={size}>
          <rect x="5" y="3" width="14" height="18" rx="2" {...stroke} />
          <path d="M9 7h6M9 11h6M9 15h4" {...stroke} />
        </Svg>
      );
    case 'desks':
      return (
        <Svg size={size}>
          <rect x="2" y="4" width="20" height="12" rx="2" {...stroke} />
          <path d="M6 16v4M18 16v4M4 20h16" {...stroke} />
        </Svg>
      );
    case 'parking':
      return (
        <Svg size={size}>
          <rect x="4" y="4" width="16" height="16" rx="2" {...stroke} />
          <path d="M9.5 8.5h3a2.5 2.5 0 0 1 0 5H11v3" {...stroke} />
        </Svg>
      );
    case 'plants':
      return (
        <Svg size={size}>
          <path d="M12 22v-6" {...stroke} />
          <path d="M12 8a4 4 0 0 0-4 4c0 2 2 3 4 6 2-3 4-4 4-6a4 4 0 0 0-4-4z" {...stroke} />
          <path d="M12 8V4" {...stroke} />
        </Svg>
      );
    case 'instruments':
      return (
        <Svg size={size}>
          <path d="M9 18V5l12-2v13" {...stroke} />
          <circle cx="6" cy="18" r="3" {...stroke} />
          <path d="M12 7v8" {...stroke} />
        </Svg>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function WhyValueIcon({ id, size = 24 }: { id: WhyIconId; size?: number }) {
  switch (id) {
    case 'students':
      return (
        <Svg size={size}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
          <circle cx="9" cy="7" r="4" {...stroke} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...stroke} />
        </Svg>
      );
    case 'browse':
      return (
        <Svg size={size}>
          <circle cx="11" cy="11" r="8" {...stroke} />
          <path d="m21 21-4.35-4.35" {...stroke} />
        </Svg>
      );
    case 'trust':
      return (
        <Svg size={size}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...stroke} />
        </Svg>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function ListingThumbIcon({ id, size = 32 }: { id: ListingThumbIconId; size?: number }) {
  switch (id) {
    case 'textbook':
      return (
        <Svg size={size}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...stroke} strokeWidth={2} />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            {...stroke}
            strokeWidth={2}
          />
          <path d="M8 8h8M8 12h6" {...stroke} strokeWidth={2} />
        </Svg>
      );
    case 'furniture':
      return (
        <Svg size={size}>
          <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" {...stroke} strokeWidth={2} />
          <path
            d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v0a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v0a2 2 0 0 0-4 0z"
            {...stroke}
            strokeWidth={2}
          />
        </Svg>
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

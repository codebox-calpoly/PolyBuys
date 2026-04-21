import type { ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'ghost' | 'ghostOnDark' | 'cream';
export type ButtonSize = 'sm' | 'md' | 'lg';

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  trailingArrow?: boolean;
  className?: string;
  children: ReactNode;
};

type LinkProps = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  onClick?: never;
};

type ActionProps = CommonProps & {
  onClick: () => void;
  href?: never;
  ariaLabel?: string;
};

export type ButtonProps = LinkProps | ActionProps;

function classesFor(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return cx('pb-btn', `pb-btn--${size}`, `pb-btn--${variant}`, extra);
}

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', trailingArrow, className, children } = props;
  const classes = classesFor(variant, size, className);

  const body = (
    <>
      {children}
      {trailingArrow ? (
        <span className="pb-btn__arrow" aria-hidden>
          →
        </span>
      ) : null}
    </>
  );

  if ('href' in props && props.href !== undefined) {
    const { target, rel } = props;
    const finalRel =
      target === '_blank' && (rel == null || rel === '') ? 'noopener noreferrer' : rel;

    return (
      <a
        href={props.href}
        target={target}
        rel={finalRel}
        aria-label={props.ariaLabel}
        className={classes}
      >
        {body}
      </a>
    );
  }

  return (
    <button type="button" onClick={props.onClick} aria-label={props.ariaLabel} className={classes}>
      {body}
    </button>
  );
}

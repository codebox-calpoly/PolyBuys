import type { ReactNode } from 'react';
import { cx } from './cx';

export type EyebrowTone = 'default' | 'muted' | 'onDark';

interface EyebrowProps {
  tone?: EyebrowTone;
  as?: 'p' | 'div';
  className?: string;
  children: ReactNode;
}

export function Eyebrow({ tone = 'default', as = 'div', className, children }: EyebrowProps) {
  const classes = cx(
    'pb-eyebrow',
    tone === 'muted' && 'pb-eyebrow--muted',
    tone === 'onDark' && 'pb-eyebrow--onDark',
    className
  );
  const inner = (
    <>
      <span className="pb-eyebrow__dot" />
      {children}
    </>
  );
  return as === 'p' ? <p className={classes}>{inner}</p> : <div className={classes}>{inner}</div>;
}

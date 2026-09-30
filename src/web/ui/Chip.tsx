import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

export interface ChipProps extends ComponentProps<'span'> {
  tone?: 'pos' | 'neg' | 'neutral';
}

const TONES = {
  pos: 'bg-pos-tint text-pos',
  neg: 'bg-neg-tint text-neg-text',
  neutral: 'bg-surface-2 text-ink-2',
};

export function Chip({ tone = 'neutral', className, ...rest }: ChipProps) {
  return (
    <span
      className={clsx(
        'num inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px]',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}

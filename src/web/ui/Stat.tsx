import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface StatProps {
  label: string;
  /** Normalmente um <Amount />, mas aceita qualquer valor. */
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <div className="eyebrow">{label}</div>
      <div className="num text-[16px] font-medium">{value}</div>
      {hint ? <div className="text-[12px] text-ink-2">{hint}</div> : null}
    </div>
  );
}

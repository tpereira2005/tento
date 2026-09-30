import { clsx } from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

export function Card({ className, ...rest }: ComponentProps<'section'>) {
  return (
    <section
      className={clsx('rounded-[14px] border border-line bg-surface p-5 sm:p-6', className)}
      {...rest}
    />
  );
}

export interface SectionHeaderProps {
  /** Número da secção, ex.: "01". */
  number?: string;
  title: string;
  /** Conteúdo à direita (legenda, ligação, filtros). */
  right?: ReactNode;
  id?: string;
  className?: string;
}

export function SectionHeader({ number, title, right, id, className }: SectionHeaderProps) {
  return (
    <div className={clsx('mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1', className)}>
      <div className="flex items-baseline gap-2.5">
        {number ? (
          <span className="num text-[11px] text-ink-2" aria-hidden="true">
            {number}
          </span>
        ) : null}
        <h2 id={id} className="font-display text-[22px] leading-tight font-normal tracking-[-0.01em]">
          {title}
        </h2>
      </div>
      {right ? <div className="text-[12px] text-ink-2">{right}</div> : null}
    </div>
  );
}

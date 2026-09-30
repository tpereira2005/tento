import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

/** Bloco de espaço reservado; sem animação (respeita movimento reduzido por definição). */
export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={clsx('rounded-[10px] bg-surface-2', className)} {...rest} />;
}

import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Amount } from '../../ui';
import { formatShare } from './derive';

/** Segmento de barra proporcional à partilha; coral para negativo, cobalto para positivo (nunca só a cor: há sinal e %). */
export function ShareBar({
  share,
  netCents,
  strong = false,
  className,
}: {
  share: number;
  netCents: number;
  strong?: boolean;
  className?: string;
}) {
  const tone = netCents < 0 ? (strong ? 'bg-neg' : 'bg-share-2') : strong ? 'bg-pos' : 'bg-pos-tint';
  return (
    <span
      className={clsx('block h-full', tone, className)}
      style={{ width: `${String(Math.min(100, Math.max(0, share * 100)))}%` }}
    />
  );
}

export interface ShareRowProps {
  name: ReactNode;
  sub: ReactNode;
  netCents: number;
  share: number;
}

/** Linha com nome, subtítulo, resultado e barra da partilha ("Por casa" e "Contas"). */
export function ShareRow({ name, sub, netCents, share }: ShareRowProps) {
  return (
    <li className="border-b border-line py-3 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{name}</span>
        <Amount cents={netCents} withTriangle signed className="text-[14px]" />
      </div>
      <div className="mt-0.5 truncate text-[12px] text-ink-2">{sub}</div>
      <div className="mt-2 flex items-center gap-3">
        <div aria-hidden="true" className="flex h-1.5 flex-1 rounded-[3px] bg-surface-2">
          <ShareBar share={share} netCents={netCents} strong className="rounded-[3px]" />
        </div>
        <span className="num w-10 text-right text-[12px] text-ink-2">{formatShare(share)}</span>
      </div>
    </li>
  );
}

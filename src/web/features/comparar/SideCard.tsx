import { CalendarX2 } from 'lucide-react';
import { formatCents } from '../../../core';
import { t } from '../../i18n';
import { Amount, Card, Stat, Triangle } from '../../ui';
import { fill, monthLabel } from '../painel/derive';
import type { SideModel } from './derive';

export interface SideCardProps {
  side: SideModel;
  /** "Lado A" / "Lado B". */
  eyebrow: string;
  /** Estilo da linha no gráfico, repetido aqui para ligar o cartão à curva. */
  line: 'solid' | 'dashed';
  headingId: string;
}

function LineSample({ line }: { line: 'solid' | 'dashed' }) {
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        x2="27"
        y1="5"
        y2="5"
        stroke={line === 'solid' ? 'var(--ink)' : 'var(--ink-2)'}
        strokeWidth={line === 'solid' ? 2.5 : 2}
        {...(line === 'dashed' ? { strokeDasharray: '6 4' } : {})}
      />
    </svg>
  );
}

/** Um lado da comparação: nome, resultado líquido em destaque e os números de apoio. */
export function SideCard({ side, eyebrow, line, headingId }: SideCardProps) {
  const s = t().compare.side;
  const c = t().compare;
  const { summary } = side;
  return (
    <Card aria-labelledby={headingId} className="h-full p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <LineSample line={line} />
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h2 id={headingId} className="mt-1.5 truncate font-display text-[24px] leading-tight font-normal">
        {side.name}
      </h2>

      {side.empty ? (
        <div className="mt-6 flex flex-col items-start gap-2">
          <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2">
            <CalendarX2 size={20} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="font-display text-[22px]">{c.noMovements}</p>
          <p className="text-ink-2">{c.noMovementsHint}</p>
        </div>
      ) : (
        <>
          <div className="mt-5 eyebrow">{s.net}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {summary.netCents === 0 ? null : (
              <span className="[&>svg]:size-5 sm:[&>svg]:size-6">
                <Triangle direction={summary.netCents > 0 ? 'up' : 'down'} size={24} />
              </span>
            )}
            <Amount
              cents={summary.netCents}
              variant="display"
              signed
              className="text-[40px] leading-none tracking-[-0.03em] sm:text-[52px]"
            />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4">
            <Stat label={s.deposited} value={formatCents(summary.depositedCents)} />
            <Stat label={s.withdrawn} value={formatCents(summary.withdrawnCents)} />
            <Stat
              label={s.positiveMonths}
              value={fill(s.ofTotal, { n: summary.positiveMonths, total: summary.months })}
            />
            <Stat label={s.avg} value={<Amount cents={summary.avgMonthlyNetCents} signed />} />
            <Stat
              label={s.best}
              value={
                summary.bestMonth ? (
                  <span className="flex flex-col">
                    <Amount cents={summary.bestMonth.netCents} signed />
                    <span className="text-[12px] font-normal text-ink-2">
                      {monthLabel(summary.bestMonth.month)}
                    </span>
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Stat
              label={s.worst}
              value={
                summary.worstMonth ? (
                  <span className="flex flex-col">
                    <Amount cents={summary.worstMonth.netCents} signed />
                    <span className="text-[12px] font-normal text-ink-2">
                      {monthLabel(summary.worstMonth.month)}
                    </span>
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </>
      )}
    </Card>
  );
}

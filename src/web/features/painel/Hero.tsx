import { formatCents, formatPercent, type MonthlyPoint, type Summary } from '../../../core';
import { t } from '../../i18n';
import { Amount, Card, Stat, Triangle } from '../../ui';
import { formatIsoDate } from '../definicoes/helpers';
import { fill, monthAbbr, monthLabel } from './derive';
import type { Period } from './search';

const MONTHS_OF_PERIOD: Record<Period, number | null> = { '3m': 3, '6m': 6, '12m': 12, tudo: null };

/** "nos últimos 12 meses" / "em todo o período". */
export function periodPhrase(period: Period): string {
  const h = t().dashboard.hero;
  const n = MONTHS_OF_PERIOD[period];
  return n === null ? h.periodAll : fill(h.periodLast, { n });
}

function Eyebrow({ children }: { children: string }) {
  return <div className="eyebrow">{children}</div>;
}

function FlowBar({ ratio, tone }: { ratio: number; tone: 'ink' | 'pos' }) {
  const width = `${String(Math.min(100, Math.max(0, ratio * 100)))}%`;
  return (
    <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-[3px] bg-surface-2">
      <div className={`h-1.5 rounded-[3px] ${tone === 'ink' ? 'bg-ink' : 'bg-pos'}`} style={{ width }} />
    </div>
  );
}

function Pips({ monthly }: { monthly: readonly MonthlyPoint[] }) {
  const h = t().dashboard.hero;
  return (
    <ol aria-label={h.pipsLabel} className="flex flex-wrap gap-x-[5px] gap-y-2">
      {monthly.map((p) => (
        <li key={p.month} className="flex flex-col items-center gap-1">
          <span
            aria-hidden="true"
            className={`grid size-5 place-items-center rounded-[5px] ${
              p.netCents > 0 ? 'bg-pos-tint' : p.netCents < 0 ? 'bg-neg-tint' : 'bg-surface-2'
            }`}
          >
            {p.netCents === 0 ? (
              <span className="h-px w-2 bg-ink-2" />
            ) : (
              <Triangle direction={p.netCents > 0 ? 'up' : 'down'} size={9} />
            )}
          </span>
          <span aria-hidden="true" className="num text-[10px] text-ink-2">
            {monthAbbr(p.month).charAt(0)}
          </span>
          <span className="sr-only">
            {monthLabel(p.month)}: {formatCents(p.netCents, { signed: true })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function daysAgo(days: number): string {
  const h = t().dashboard.hero;
  return days === 0 ? h.today : days === 1 ? h.daysAgoOne : fill(h.daysAgo, { n: days });
}

export interface HeroProps {
  summary: Summary;
  monthly: readonly MonthlyPoint[];
  period: Period;
}

/** O número que importa: resultado líquido, depositado vs levantado, meses positivos e a linha de estatísticas. */
export function Hero({ summary, monthly, period }: HeroProps) {
  const h = t().dashboard.hero;
  const { depositedCents, withdrawnCents, netCents, withdrawnRatio } = summary;
  const flowMax = Math.max(depositedCents, withdrawnCents, 1);
  const sentence =
    withdrawnRatio === null
      ? fill(h.noDeposits, { period: periodPhrase(period) })
      : fill(h.sentence, { ratio: formatPercent(withdrawnRatio), period: periodPhrase(period) });

  return (
    <Card aria-labelledby="hero-titulo" className="p-5 sm:p-8">
      <h2 id="hero-titulo" className="sr-only">
        {h.eyebrow}
      </h2>
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr_0.95fr] lg:gap-0">
        <div className="min-w-0 lg:pr-8">
          <Eyebrow>{h.eyebrow}</Eyebrow>
          <div className="mt-2.5 flex flex-wrap items-center gap-3 sm:gap-4">
            {netCents === 0 ? null : (
              <span className="[&>svg]:size-5 sm:[&>svg]:size-7 xl:[&>svg]:size-8">
                <Triangle direction={netCents > 0 ? 'up' : 'down'} size={28} />
              </span>
            )}
            <Amount
              cents={netCents}
              variant="display"
              className="text-[52px] leading-[0.95] tracking-[-0.03em] sm:text-[80px] xl:text-[100px]"
            />
          </div>
          <p className="mt-3.5 font-display text-[17px] text-ink-2 italic sm:text-[19px]">{sentence}</p>
        </div>

        <div className="min-w-0 border-t border-line pt-6 lg:border-t-0 lg:border-l lg:px-8 lg:pt-0">
          <Eyebrow>{h.flowEyebrow}</Eyebrow>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-1">
            <div>
              <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
                <span className="text-ink-2">{h.deposited}</span>
                <span className="font-display text-[26px] tracking-[-0.01em] sm:text-[30px]">
                  {formatCents(depositedCents)}
                </span>
              </div>
              <FlowBar ratio={depositedCents / flowMax} tone="ink" />
            </div>
            <div>
              <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
                <span className="text-ink-2">{h.withdrawn}</span>
                <span className="font-display text-[26px] tracking-[-0.01em] text-pos sm:text-[30px]">
                  {formatCents(withdrawnCents)}
                </span>
              </div>
              <FlowBar ratio={withdrawnCents / flowMax} tone="pos" />
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <Eyebrow>{h.positiveMonths}</Eyebrow>
          <p className="mt-2 mb-3.5 flex items-baseline gap-2">
            <span className="font-display text-[56px] leading-none font-light text-pos">
              {summary.positiveMonths}
            </span>
            <span className="font-display text-[22px] text-ink-2">
              {fill(h.ofTotal, { total: summary.months })}
            </span>
          </p>
          <Pips monthly={monthly} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 lg:grid-cols-4">
        <Stat label={h.avg} value={<Amount cents={summary.avgMonthlyNetCents} signed />} />
        <Stat
          label={h.best}
          value={
            summary.bestMonth ? (
              <>
                {monthAbbr(summary.bestMonth.month)} · <Amount cents={summary.bestMonth.netCents} signed />
              </>
            ) : (
              '—'
            )
          }
        />
        <Stat
          label={h.worst}
          value={
            summary.worstMonth ? (
              <>
                {monthAbbr(summary.worstMonth.month)} · <Amount cents={summary.worstMonth.netCents} signed />
              </>
            ) : (
              '—'
            )
          }
        />
        <Stat
          label={h.lastDeposit}
          value={
            summary.lastDeposit && summary.daysSinceLastDeposit !== null ? (
              <>
                {formatIsoDate(summary.lastDeposit.date)} ·{' '}
                <span className="text-ink-2">{daysAgo(summary.daysSinceLastDeposit)}</span>
              </>
            ) : (
              h.none
            )
          }
        />
      </div>
    </Card>
  );
}

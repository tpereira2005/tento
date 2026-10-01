import { formatCents, type DayCell, type MonthlyPoint } from '../../../core';
import {
  ChartFrame,
  ChartLegend,
  CumulativeChart,
  DepositHeatmap,
  HeatLegend,
  MonthlyBars,
} from '../../charts';
import { t } from '../../i18n';
import { Triangle } from '../../ui';
import { formatIsoDate } from '../definicoes/helpers';
import { belowZeroSince, fill, monthLabel, monthName } from './derive';

function rangeLabels(monthly: readonly MonthlyPoint[]) {
  return {
    from: monthLabel(monthly[0]?.month ?? ''),
    to: monthLabel(monthly[monthly.length - 1]?.month ?? ''),
  };
}

/** 01 — Resultado acumulado, com a nota "abaixo de zero desde …" quando a série acaba no negativo. */
export function CumulativeCard({ monthly }: { monthly: readonly MonthlyPoint[] }) {
  const c = t().dashboard.cumulative;
  const since = belowZeroSince(monthly);
  const last = monthly[monthly.length - 1];
  return (
    <ChartFrame
      number="01"
      title={c.title}
      right={c.hint}
      table={{
        caption: c.tableCaption,
        columns: [c.colMonth, c.colNet, c.colCumulative],
        rows: monthly.map((p) => [
          monthLabel(p.month),
          formatCents(p.netCents, { signed: true }),
          formatCents(p.cumulativeCents, { signed: true }),
        ]),
      }}
    >
      <CumulativeChart
        points={monthly.map((p) => ({ month: p.month, cumulativeCents: p.cumulativeCents }))}
        {...(since ? { annotation: fill(c.belowZero, { month: monthName(since) }) } : {})}
        ariaLabel={fill(c.aria, { ...rangeLabels(monthly), value: formatCents(last?.cumulativeCents ?? 0) })}
      />
    </ChartFrame>
  );
}

/** 02 — Resultado mensal. */
export function MonthlyCard({
  monthly,
  positive,
  negative,
}: {
  monthly: readonly MonthlyPoint[];
  positive: number;
  negative: number;
}) {
  const m = t().dashboard.monthly;
  return (
    <ChartFrame
      number="02"
      title={m.title}
      right={
        <span className="num inline-flex items-center gap-1.5">
          <span className="sr-only">{fill(m.counts, { positive, negative })}</span>
          <span aria-hidden="true" className="inline-flex items-center gap-1.5">
            {positive} <Triangle direction="up" size={9} /> · {negative}{' '}
            <Triangle direction="down" size={9} />
          </span>
        </span>
      }
      table={{
        caption: m.tableCaption,
        columns: [m.colMonth, m.colDeposited, m.colWithdrawn, m.colNet],
        rows: monthly.map((p) => [
          monthLabel(p.month),
          formatCents(p.depositedCents),
          formatCents(p.withdrawnCents),
          formatCents(p.netCents, { signed: true }),
        ]),
      }}
    >
      <MonthlyBars
        points={monthly.map((p) => ({ month: p.month, netCents: p.netCents }))}
        ariaLabel={fill(m.aria, { ...rangeLabels(monthly), positive, negative })}
      />
      <div className="mt-2 flex justify-center text-[12px] text-ink-2">
        <ChartLegend />
      </div>
    </ChartFrame>
  );
}

/** 03 — Dias com depósito. */
export function DaysCard({ days }: { days: readonly DayCell[] }) {
  const d = t().dashboard.days;
  const first = days[0]?.date ?? '';
  const last = days[days.length - 1]?.date ?? '';
  return (
    <ChartFrame
      number="03"
      title={d.title}
      right={<HeatLegend />}
      table={{
        caption: d.tableCaption,
        columns: [d.colDate, d.colDeposited],
        rows: days
          .filter((x) => x.depositedCents > 0)
          .map((x) => [formatIsoDate(x.date), formatCents(x.depositedCents)]),
      }}
    >
      <DepositHeatmap
        days={days.map((x) => ({ date: x.date, depositedCents: x.depositedCents, level: x.level }))}
        ariaLabel={fill(d.aria, { from: formatIsoDate(first), to: formatIsoDate(last) })}
      />
      <p className="mt-3 text-[13px] text-ink-2">{d.caption}</p>
    </ChartFrame>
  );
}

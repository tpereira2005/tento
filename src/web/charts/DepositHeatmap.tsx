import { calendarGrid } from '../../core/charts';
import { formatCents } from '../../core/format';
import type { IsoDate } from '../../core/types';
import { t } from '../i18n';
import { formatIsoDate, monthShort, useChartWidth } from './shared';

export interface DepositHeatmapProps {
  days: { date: string; depositedCents: number; level: 0 | 1 | 2 | 3 | 4 }[];
  ariaLabel: string;
}

const LEFT = 30;
const TOP = 18;
const GAP = 3;
/** Largura aproximada de uma etiqueta de mês (3 letras em DM Mono 11 px). */
const MONTH_LABEL_WIDTH = 22;
const MIN_CELL = 10;
const MAX_CELL = 14;

/** Calendário de dias com depósito: um quadrado por dia, semanas em colunas (segunda primeiro). */
export function DepositHeatmap({ days, ariaLabel }: DepositHeatmapProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const messages = t().charts;

  if (days.length === 0) {
    return (
      <div ref={ref} className="flex min-h-24 items-center">
        <p className="font-display text-[16px] text-ink-2 italic">{messages.emptyDays}</p>
      </div>
    );
  }

  const probe = calendarGrid(
    days.map((d) => ({ date: d.date as IsoDate, level: d.level })),
    { cell: 1, gap: 0, weekStart: 'monday' },
  );
  const columns = Math.max(probe.columns, 1);
  const fit = Math.floor((width - LEFT - (columns - 1) * GAP) / columns);
  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, fit));
  const grid = calendarGrid(
    days.map((d) => ({ date: d.date as IsoDate, level: d.level })),
    { cell, gap: GAP, weekStart: 'monday' },
  );
  const cents = new Map(days.map((d) => [d.date, d.depositedCents]));
  const svgWidth = LEFT + grid.width;
  const svgHeight = TOP + grid.height;
  const step = cell + GAP;
  const rowLabels = [
    { row: 0, text: messages.weekdayMon },
    { row: 2, text: messages.weekdayWed },
    { row: 4, text: messages.weekdayFri },
  ];

  return (
    <div ref={ref} className="w-full">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- região com scroll tem de ser focável (axe) */}
      <div className="overflow-x-auto" role="region" aria-label={messages.scrollRegion} tabIndex={0}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={ariaLabel}
          className="block"
        >
          {/* Uma etiqueta que não cabe por inteiro (o mês que começa na última coluna) fica de fora. */}
          {grid.monthLabels
            .filter((m) => LEFT + m.x + MONTH_LABEL_WIDTH <= svgWidth)
            .map((m) => (
              <text key={m.month} x={LEFT + m.x} y={11} className="num" fontSize="11" fill="var(--ink-2)">
                {monthShort(m.month)}
              </text>
            ))}
          {rowLabels.map((r) => (
            <text
              key={r.row}
              x={0}
              y={TOP + r.row * step + cell * 0.8}
              className="num"
              fontSize="10"
              fill="var(--ink-2)"
            >
              {r.text}
            </text>
          ))}
          {grid.cells.map((c) => (
            <rect
              key={c.date}
              x={LEFT + c.x}
              y={TOP + c.y}
              width={cell}
              height={cell}
              rx={2.5}
              fill={`var(--heat-${c.level})`}
              data-level={c.level}
              data-date={c.date}
            >
              <title>{`${formatIsoDate(c.date)}: ${formatCents(cents.get(c.date) ?? 0)}`}</title>
            </rect>
          ))}
        </svg>
      </div>
    </div>
  );
}

import { signedBars, type Domain } from '../../core/charts';
import { t } from '../i18n';
import { formatBarLabel, formatTick, labelIndices, MIN_BAND, monthShort, useChartWidth } from './shared';

export interface MonthlyBarsProps {
  points: { month: string; netCents: number }[];
  height?: number;
  compact?: boolean;
  ariaLabel: string;
  /** Domínio vertical fixo, para vários gráficos partilharem a mesma escala. */
  yDomain?: Domain;
}

/** Resultado mensal: barras a partir da linha do zero, só os extremos com rótulo. */
export function MonthlyBars({
  points,
  height = 264,
  compact: compactProp,
  ariaLabel,
  yDomain,
}: MonthlyBarsProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const compact = compactProp ?? width < 300;

  if (points.length < 1) {
    return (
      <div ref={ref} className="flex min-h-24 items-center">
        <p className="font-display text-[16px] text-ink-2 italic">{t().charts.empty}</p>
      </div>
    );
  }

  const padding = { top: 26, right: 6, bottom: 34, left: compact ? 40 : 46 };
  const geo = signedBars(
    points.map((p) => p.netCents),
    { width, height, padding },
    { radius: 3, tickCount: width < 400 ? 3 : 5, ...(yDomain ? { yDomain } : {}) },
  );
  const plotRight = width - padding.right;
  const showMonth = labelIndices(
    points.length,
    compact || (width - padding.left - padding.right) / points.length < MIN_BAND,
  );
  const step =
    geo.yTicks.length > 1 ? Math.abs((geo.yTicks[1]?.value ?? 0) - (geo.yTicks[0]?.value ?? 0)) : 0;
  const tickShown = (value: number) => !compact || step === 0 || Math.round(value / step) % 2 === 0;

  const { maxIndex, minIndex } = geo.extremes;
  const maxBar = geo.bars[maxIndex];
  const minBar = geo.bars[minIndex];

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        {geo.yTicks.map((tick) =>
          tick.value === 0 ? (
            <line
              key={tick.value}
              x1={padding.left}
              x2={plotRight}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--ink)"
              strokeWidth="1"
            />
          ) : tickShown(tick.value) ? (
            <line
              key={tick.value}
              x1={padding.left}
              x2={plotRight}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          ) : null,
        )}
        {geo.yTicks.map((tick) =>
          tickShown(tick.value) ? (
            <text
              key={tick.value}
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="num"
              fontSize="11"
              fill="var(--ink-2)"
            >
              {tick.value === 0 ? '0' : formatTick(tick.value)}
            </text>
          ) : null,
        )}

        {geo.bars.map((bar, i) =>
          bar.sign === 'zero' ? null : (
            <rect
              key={points[i]?.month ?? i}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={bar.rx}
              fill={bar.sign === 'positive' ? 'var(--pos)' : 'var(--neg)'}
              data-bar={bar.sign}
            />
          ),
        )}

        {points.map((p, i) =>
          showMonth.has(i) ? (
            <text
              key={p.month}
              x={geo.centers[i]}
              y={height - 8}
              textAnchor="middle"
              className="num"
              fontSize="11"
              fill={i === points.length - 1 ? 'var(--ink)' : 'var(--ink-2)'}
              fontWeight={i === points.length - 1 ? 600 : 400}
            >
              {monthShort(p.month)}
            </text>
          ) : null,
        )}

        {maxBar?.sign === 'positive' ? (
          <text
            x={maxBar.x + maxBar.width / 2}
            y={maxBar.y - 6}
            textAnchor="middle"
            className="num"
            fontSize="11"
            fill="var(--pos)"
          >
            {formatBarLabel(maxBar.value)}
          </text>
        ) : null}
        {minBar?.sign === 'negative' ? (
          <text
            x={Math.min(minBar.x + minBar.width, plotRight)}
            y={minBar.y + minBar.height + 14}
            textAnchor="end"
            className="num"
            fontSize="11"
            fill="var(--neg-text)"
          >
            {formatBarLabel(minBar.value)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

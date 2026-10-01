import { cumulativeLine, sharedYDomain } from '../../core/charts';
import { formatCents } from '../../core/format';
import { t } from '../i18n';
import { formatTick, labelIndices, MIN_BAND, NARROW_WIDTH, useChartWidth } from './shared';

export interface CompareSeries {
  name: string;
  /** Resultado acumulado, um valor por mês, em cêntimos. */
  values: readonly number[];
}

export interface CompareLinesProps {
  a: CompareSeries;
  b: CompareSeries;
  /** Rótulo curto do eixo de cada posição (mesmo comprimento das séries). */
  labels: readonly string[];
  height?: number;
  ariaLabel: string;
  /** Texto quando há menos de dois meses. */
  emptyText?: string;
}

const HALO = {
  paintOrder: 'stroke',
  stroke: 'var(--surface)',
  strokeWidth: 4,
  strokeLinejoin: 'round',
} as const;

const MAX_NAME = 16;

function shortName(name: string): string {
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;
}

/** Afasta dois rótulos que se sobreporiam, mantendo a ordem vertical. */
function spread(ya: number, yb: number, gap: number): [number, number] {
  if (Math.abs(ya - yb) >= gap) return [ya, yb];
  const mid = (ya + yb) / 2;
  return ya <= yb ? [mid - gap / 2, mid + gap / 2] : [mid + gap / 2, mid - gap / 2];
}

/**
 * Dois resultados acumulados no mesmo eixo. O lado A é uma linha contínua com marcador redondo; o B é
 * tracejado com marcador quadrado: distinguem-se sem depender da cor. Os nomes vão no fim de cada linha.
 */
export function CompareLines({ a, b, labels, height = 280, ariaLabel, emptyText }: CompareLinesProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const compact = width < NARROW_WIDTH;
  const n = Math.min(a.values.length, b.values.length, labels.length);

  if (n < 2) {
    return (
      <div ref={ref} className="flex min-h-24 items-center">
        <p className="font-display text-[16px] text-ink-2 italic">{emptyText ?? t().charts.empty}</p>
      </div>
    );
  }

  const padding = { top: 22, right: compact ? 76 : 136, bottom: 44, left: compact ? 40 : 48 };
  const box = { width, height, padding };
  const yDomain = sharedYDomain([a.values, b.values], 5);
  const geoA = cumulativeLine(a.values, box, { yDomain });
  const geoB = cumulativeLine(b.values, box, { yDomain });
  const plotRight = width - padding.right;
  const lastA = geoA.points[n - 1];
  const lastB = geoB.points[n - 1];
  const showLabel = labelIndices(n, compact || (width - padding.left - padding.right) / n < MIN_BAND);
  const step =
    geoA.yTicks.length > 1 ? Math.abs((geoA.yTicks[1]?.value ?? 0) - (geoA.yTicks[0]?.value ?? 0)) : 0;
  const tickShown = (value: number) => !compact || step === 0 || Math.round(value / step) % 2 === 0;

  const [labelYA, labelYB] = spread(lastA?.y ?? 0, lastB?.y ?? 0, compact ? 18 : 34);
  const endLabel = (
    series: CompareSeries,
    point: { x: number; value: number } | undefined,
    y: number,
    part: string,
  ) =>
    point ? (
      <g data-part={part}>
        {compact ? null : (
          <text x={point.x + 14} y={y - 3} className="num" fontSize="11" fill="var(--ink-2)" style={HALO}>
            {shortName(series.name)}
          </text>
        )}
        <text
          x={point.x + 14}
          y={compact ? y + 4 : y + 12}
          className="num"
          fontSize="13"
          fontWeight="500"
          fill={point.value < 0 ? 'var(--neg-text)' : point.value > 0 ? 'var(--pos)' : 'var(--ink)'}
          style={HALO}
        >
          {formatCents(point.value, { signed: true, currency: !compact })}
        </text>
      </g>
    ) : null;

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
        {geoA.yTicks.map((tick) =>
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
        {geoA.yTicks.map((tick) =>
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

        <path
          d={geoB.linePath}
          fill="none"
          stroke="var(--ink-2)"
          strokeWidth="2"
          strokeDasharray="7 5"
          strokeLinejoin="round"
          data-part="line-b"
        />
        <path
          d={geoA.linePath}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          data-part="line-a"
        />

        {lastB ? (
          <rect
            x={lastB.x - 4.5}
            y={lastB.y - 4.5}
            width="9"
            height="9"
            fill="var(--surface)"
            stroke="var(--ink-2)"
            strokeWidth="2"
            data-part="marker-b"
          />
        ) : null}
        {lastA ? (
          <circle
            cx={lastA.x}
            cy={lastA.y}
            r="5"
            fill="var(--ink)"
            stroke="var(--surface)"
            strokeWidth="2"
            data-part="marker-a"
          />
        ) : null}

        {labels.slice(0, n).map((label, i) =>
          showLabel.has(i) ? (
            <text
              key={i}
              x={geoA.xs[i]}
              y={height - 8}
              textAnchor="middle"
              className="num"
              fontSize="11"
              fill={i === n - 1 ? 'var(--ink)' : 'var(--ink-2)'}
              fontWeight={i === n - 1 ? 600 : 400}
            >
              {label}
            </text>
          ) : null,
        )}

        {endLabel(a, lastA, labelYA, 'end-a')}
        {endLabel(b, lastB, labelYB, 'end-b')}
      </svg>
    </div>
  );
}

export interface CompareLegendProps {
  a: string;
  b: string;
}

/** Legenda: amostra da linha (contínua ou tracejada) e o nome; o estilo da linha também é dito em texto. */
export function CompareLegend({ a, b }: CompareLegendProps) {
  const messages = t().charts;
  const item = (name: string, dashed: boolean) => (
    <span className="flex min-w-0 items-center gap-2">
      <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="shrink-0">
        <line
          x1="1"
          x2="27"
          y1="5"
          y2="5"
          stroke={dashed ? 'var(--ink-2)' : 'var(--ink)'}
          strokeWidth={dashed ? 2 : 2.5}
          {...(dashed ? { strokeDasharray: '6 4' } : {})}
        />
      </svg>
      <span className="truncate">{name}</span>
      <span className="sr-only">{dashed ? messages.lineDashed : messages.lineSolid}</span>
    </span>
  );
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {item(a, false)}
      {item(b, true)}
    </span>
  );
}

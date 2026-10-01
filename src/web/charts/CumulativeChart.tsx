import { useId } from 'react';
import { cumulativeLine } from '../../core/charts';
import { formatCents } from '../../core/format';
import { t } from '../i18n';
import {
  formatTick,
  labelIndices,
  monthShort,
  MIN_BAND,
  NARROW_WIDTH,
  safeId,
  useChartWidth,
} from './shared';

export interface CumulativeChartProps {
  points: { month: string; cumulativeCents: number }[];
  height?: number;
  compact?: boolean;
  /** Nota em itálico dentro da área negativa, ex.: "abaixo de zero desde abril". */
  annotation?: string;
  ariaLabel: string;
}

const HALO = {
  paintOrder: 'stroke',
  stroke: 'var(--surface)',
  strokeWidth: 4,
  strokeLinejoin: 'round',
} as const;

/** Resultado acumulado: curva monótona, área azul acima do zero e tracejado coral abaixo. */
export function CumulativeChart({
  points,
  height = 264,
  compact: compactProp,
  annotation,
  ariaLabel,
}: CumulativeChartProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const uid = safeId(useId());
  const compact = compactProp ?? width < NARROW_WIDTH;
  const messages = t().charts;

  if (points.length < 2) {
    return (
      <div ref={ref} className="flex min-h-24 items-center">
        <p className="font-display text-[16px] text-ink-2 italic">{messages.empty}</p>
      </div>
    );
  }

  const padding = { top: 22, right: compact ? 78 : 116, bottom: 44, left: compact ? 40 : 48 };
  const geo = cumulativeLine(
    points.map((p) => p.cumulativeCents),
    { width, height, padding },
  );
  const plotRight = width - padding.right;
  const last = geo.points[geo.points.length - 1];
  const lastMonth = points[points.length - 1]?.month ?? '';
  const showMonth = labelIndices(
    points.length,
    compact || (width - padding.left - padding.right) / points.length < MIN_BAND,
  );

  // Marcas do eixo: no modo compacto, só as alternadas (sempre com o zero).
  const step =
    geo.yTicks.length > 1 ? Math.abs((geo.yTicks[1]?.value ?? 0) - (geo.yTicks[0]?.value ?? 0)) : 0;
  const tickShown = (value: number) => !compact || step === 0 || Math.round(value / step) % 2 === 0;

  // Rótulos diretos: o primeiro ponto e os picos positivos.
  const labelled = geo.points
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => {
      if (p.value <= 0) return false;
      if (i === 0) return true;
      const prev = geo.points[i - 1]?.value ?? -Infinity;
      const next = geo.points[i + 1]?.value ?? -Infinity;
      return p.value >= prev && p.value >= next;
    });

  // Anotação: abaixo da curva, a meio da última sequência negativa.
  let note: { x: number; y: number } | null = null;
  if (annotation && !compact) {
    let start = geo.points.length;
    while (start > 0 && (geo.points[start - 1]?.value ?? 0) < 0) start -= 1;
    if (start < geo.points.length) {
      const x0 = geo.xs[start] ?? 0;
      const x1 = geo.xs[geo.xs.length - 1] ?? 0;
      const x = x0 + (x1 - x0) * 0.45;
      let curveY = 0;
      for (let dx = -80; dx <= 80; dx += 10) {
        const sx = Math.min(Math.max(x + dx, x0), x1);
        const j = Math.min(
          geo.xs.findIndex((v) => v >= sx),
          geo.xs.length - 1,
        );
        const a = geo.points[Math.max(j - 1, 0)];
        const b = geo.points[j];
        if (a && b) {
          const f = b.x === a.x ? 0 : (sx - a.x) / (b.x - a.x);
          curveY = Math.max(curveY, a.y + (b.y - a.y) * Math.min(Math.max(f, 0), 1));
        }
      }
      note = { x, y: Math.min(curveY + 26, height - padding.bottom - 6) };
    }
  }

  const endLabel = last ? formatCents(last.value, { signed: false, currency: !compact }) : '';
  const endNegative = (last?.value ?? 0) < 0;

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
        <defs>
          <pattern
            id={`${uid}-hatch`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--neg)" strokeWidth="1.2" opacity="0.6" />
          </pattern>
          <clipPath id={`${uid}-above`}>
            <rect x="0" y="0" width={width} height={geo.zeroY} />
          </clipPath>
          <clipPath id={`${uid}-below`}>
            <rect x="0" y={geo.zeroY} width={width} height={height - geo.zeroY} />
          </clipPath>
        </defs>

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

        <path
          d={geo.areaAbovePath}
          fill="var(--pos-tint)"
          clipPath={`url(#${uid}-above)`}
          data-part="area-above"
        />
        <path
          d={geo.areaBelowPath}
          fill={`url(#${uid}-hatch)`}
          clipPath={`url(#${uid}-below)`}
          data-part="area-below"
        />
        <path
          d={geo.linePath}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2"
          strokeLinejoin="round"
          data-part="line"
        />

        {geo.points.map((p, i) => (
          <circle
            key={points[i]?.month ?? i}
            cx={p.x}
            cy={p.y}
            r={i === geo.points.length - 1 ? 5 : 3.5}
            fill={p.value >= 0 ? 'var(--pos)' : 'var(--neg)'}
            stroke="var(--surface)"
            strokeWidth="2"
            data-part="dot"
          />
        ))}

        {points.map((p, i) =>
          showMonth.has(i) ? (
            <text
              key={p.month}
              x={geo.xs[i]}
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

        {labelled.map(({ p, i }) => (
          <text
            key={`l-${points[i]?.month ?? i}`}
            x={p.x}
            y={p.y - 8}
            textAnchor={i === 0 ? 'start' : 'middle'}
            className="num"
            fontSize="12"
            fill="var(--pos)"
            style={HALO}
          >
            {formatCents(p.value, { signed: true })}
          </text>
        ))}

        {last ? (
          <>
            <text
              x={last.x + 12}
              y={last.y + 4}
              className="num"
              fontSize="13"
              fontWeight="500"
              fill={endNegative ? 'var(--neg-text)' : 'var(--pos)'}
            >
              {endLabel}
            </text>
            {compact ? null : (
              <text x={last.x + 12} y={last.y - 14} className="num" fontSize="11" fill="var(--ink-2)">
                {`${messages.accumulatedIn} ${monthShort(lastMonth)}`}
              </text>
            )}
          </>
        ) : null}

        {note ? (
          <text
            x={note.x}
            y={note.y}
            textAnchor="middle"
            className="font-display"
            fontStyle="italic"
            fontSize="15"
            fill="var(--ink-2)"
            style={HALO}
          >
            {annotation}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

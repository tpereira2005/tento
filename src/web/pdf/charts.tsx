import { ClipPath, Circle, Defs, G, Line, Path, Rect, Svg, Text } from '@react-pdf/renderer';
import { cumulativeLine, signedBars } from '../../core/charts';
import { barLabel, monthShort, pdfMoney, tickLabel } from './format';
import { FONT, PDF_COLORS as C } from './theme';
import type { ReportLabels, ReportMonthly } from './types';

/*
 * Gráficos do PDF: a mesma geometria do núcleo (cumulativeLine, signedBars, niceTicks) que a interface
 * usa, desenhada com as primitivas SVG do react-pdf.
 */

interface ChartProps {
  months: ReportMonthly[];
  labels: ReportLabels;
  width: number;
  height: number;
  /** Rótulos do eixo e das marcas alternados (gráfico pequeno da capa). */
  compact?: boolean;
}

const HATCH_STEP = 5;

function labelEvery(count: number, compact: boolean): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    if (!compact || (count - 1 - i) % 2 === 0) out.add(i);
  }
  return out;
}

function Grid({
  ticks,
  left,
  right,
  hideAlternate,
}: {
  ticks: { value: number; y: number }[];
  left: number;
  right: number;
  hideAlternate: boolean;
}) {
  const step = ticks.length > 1 ? Math.abs((ticks[1]?.value ?? 0) - (ticks[0]?.value ?? 0)) : 0;
  const shown = (value: number) => !hideAlternate || step === 0 || Math.round(value / step) % 2 === 0;
  return (
    <>
      {ticks.map((tick) =>
        tick.value === 0 ? (
          <Line
            key={tick.value}
            x1={left}
            x2={right}
            y1={tick.y}
            y2={tick.y}
            stroke={C.ink}
            strokeWidth={0.8}
          />
        ) : shown(tick.value) ? (
          <Line
            key={tick.value}
            x1={left}
            x2={right}
            y1={tick.y}
            y2={tick.y}
            stroke={C.line}
            strokeWidth={0.6}
            strokeDasharray="2 3"
          />
        ) : null,
      )}
      {ticks.map((tick) =>
        shown(tick.value) ? (
          <Text
            key={`t${String(tick.value)}`}
            x={left - 6}
            y={tick.y + 3}
            textAnchor="end"
            style={{ fontFamily: FONT.mono, fontSize: 7, fill: C.ink2 }}
          >
            {tickLabel(tick.value)}
          </Text>
        ) : null,
      )}
    </>
  );
}

/** Resultado acumulado: área cobalto claro acima do zero e tracejado coral abaixo (recortado no zero). */
export function CumulativeChart({ months, labels, width, height, compact = false }: ChartProps) {
  const padding = { top: 18, right: compact ? 62 : 84, bottom: 22, left: compact ? 40 : 46 };
  const values = months.map((m) => m.cumulativeCents);
  const geo = cumulativeLine(values, { width, height, padding });
  const plotRight = width - padding.right;
  const last = geo.points[geo.points.length - 1];
  const lastMonth = months[months.length - 1]?.month ?? '';
  const showMonth = labelEvery(months.length, compact || (plotRight - padding.left) / months.length < 26);
  const bottom = height - padding.bottom;

  // Rótulos diretos: o primeiro ponto positivo e os picos positivos.
  const peaks = geo.points
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => {
      if (p.value <= 0 || compact) return false;
      if (i === 0) return true;
      const prev = geo.points[i - 1]?.value ?? -Infinity;
      const next = geo.points[i + 1]?.value ?? -Infinity;
      return p.value >= prev && p.value >= next;
    });

  const hatch: { key: number; x1: number; y1: number; x2: number; y2: number }[] = [];
  const span = bottom - geo.zeroY;
  if (span > 0) {
    for (let x = padding.left - span, key = 0; x < plotRight; x += HATCH_STEP, key += 1) {
      hatch.push({ key, x1: x, y1: geo.zeroY, x2: x + span, y2: bottom });
    }
  }
  const negativeEnd = (last?.value ?? 0) < 0;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${String(width)} ${String(height)}`}>
      <Defs>
        <ClipPath id="below-zero">
          <Rect x={padding.left} y={geo.zeroY} width={plotRight - padding.left} height={Math.max(span, 0)} />
        </ClipPath>
        <ClipPath id="curve-area">
          <Path d={geo.areaBelowPath} />
        </ClipPath>
        <ClipPath id="above-zero">
          <Rect x={padding.left} y={0} width={plotRight - padding.left} height={geo.zeroY} />
        </ClipPath>
      </Defs>

      <Grid ticks={geo.yTicks} left={padding.left} right={plotRight} hideAlternate={compact} />

      <G clipPath="url(#above-zero)">
        <Path d={geo.areaAbovePath} fill={C.posTint} />
      </G>
      <G clipPath="url(#below-zero)">
        <G clipPath="url(#curve-area)">
          {hatch.map((h) => (
            <Line
              key={h.key}
              x1={h.x1}
              y1={h.y1}
              x2={h.x2}
              y2={h.y2}
              stroke={C.neg}
              strokeWidth={0.7}
              opacity={0.55}
            />
          ))}
        </G>
      </G>
      <Path d={geo.linePath} fill="none" stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />

      {geo.points.map((p, i) => (
        <Circle
          key={months[i]?.month ?? i}
          cx={p.x}
          cy={p.y}
          r={i === geo.points.length - 1 ? 3.4 : 2.4}
          fill={p.value >= 0 ? C.pos : C.neg}
          stroke={C.surface}
          strokeWidth={1.2}
        />
      ))}

      {months.map((m, i) =>
        showMonth.has(i) ? (
          <Text
            key={m.month}
            x={geo.xs[i] ?? 0}
            y={height - 6}
            textAnchor="middle"
            style={{
              fontFamily: FONT.mono,
              fontSize: 7,
              fill: i === months.length - 1 ? C.ink : C.ink2,
              fontWeight: i === months.length - 1 ? 500 : 400,
            }}
          >
            {monthShort(m.month, labels)}
          </Text>
        ) : null,
      )}

      {peaks.map(({ p, i }) => (
        <Text
          key={`p${months[i]?.month ?? String(i)}`}
          x={p.x}
          y={p.y - 6}
          textAnchor={i === 0 ? 'start' : 'middle'}
          style={{ fontFamily: FONT.mono, fontSize: 7.5, fill: C.pos }}
        >
          {pdfMoney(p.value, { signed: true })}
        </Text>
      ))}

      {last ? (
        <>
          <Text
            x={last.x + 8}
            y={last.y + 3}
            style={{
              fontFamily: FONT.mono,
              fontSize: compact ? 7.5 : 8.5,
              fontWeight: 500,
              fill: negativeEnd ? C.negText : C.pos,
            }}
          >
            {pdfMoney(last.value, { currency: !compact })}
          </Text>
          {compact ? null : (
            <Text x={last.x + 8} y={last.y - 10} style={{ fontFamily: FONT.mono, fontSize: 7, fill: C.ink2 }}>
              {`${labels.accumulatedIn} ${monthShort(lastMonth, labels)}`}
            </Text>
          )}
        </>
      ) : null}
    </Svg>
  );
}

/** Resultado mensal: barras a partir do zero; só os extremos levam rótulo. */
export function MonthlyBarsChart({ months, labels, width, height }: ChartProps) {
  const padding = { top: 18, right: 6, bottom: 22, left: 46 };
  const geo = signedBars(
    months.map((m) => m.netCents),
    { width, height, padding },
    { radius: 2, tickCount: 4 },
  );
  const plotRight = width - padding.right;
  const showMonth = labelEvery(months.length, (plotRight - padding.left) / months.length < 22);
  const { maxIndex, minIndex } = geo.extremes;
  const maxBar = geo.bars[maxIndex];
  const minBar = geo.bars[minIndex];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${String(width)} ${String(height)}`}>
      <Grid ticks={geo.yTicks} left={padding.left} right={plotRight} hideAlternate={false} />
      {geo.bars.map((bar, i) =>
        bar.sign === 'zero' ? null : (
          <Rect
            key={months[i]?.month ?? i}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={bar.rx}
            fill={bar.sign === 'positive' ? C.pos : C.neg}
          />
        ),
      )}
      {months.map((m, i) =>
        showMonth.has(i) ? (
          <Text
            key={m.month}
            x={geo.centers[i] ?? 0}
            y={height - 6}
            textAnchor="middle"
            style={{ fontFamily: FONT.mono, fontSize: 7, fill: C.ink2 }}
          >
            {monthShort(m.month, labels)}
          </Text>
        ) : null,
      )}
      {maxBar?.sign === 'positive' ? (
        <Text
          x={maxBar.x + maxBar.width / 2}
          y={maxBar.y - 4}
          textAnchor="middle"
          style={{ fontFamily: FONT.mono, fontSize: 7.5, fill: C.pos }}
        >
          {barLabel(maxBar.value)}
        </Text>
      ) : null}
      {minBar?.sign === 'negative' ? (
        <Text
          x={Math.min(minBar.x + minBar.width, plotRight)}
          y={minBar.y + minBar.height + 10}
          textAnchor="end"
          style={{ fontFamily: FONT.mono, fontSize: 7.5, fill: C.negText }}
        >
          {barLabel(minBar.value)}
        </Text>
      ) : null}
    </Svg>
  );
}

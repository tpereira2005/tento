import { area, curveMonotoneX, line } from 'd3-shape';
import { buildYAxis, round2, type ChartBox, type Domain, type YTick } from './scales';

export interface LinePoint {
  x: number;
  y: number;
  value: number;
}

export interface CumulativeLine {
  points: LinePoint[];
  linePath: string;
  /** Área entre a curva e a linha do zero. O renderizador recorta-a em `zeroY` (acima/abaixo). */
  areaAbovePath: string;
  areaBelowPath: string;
  zeroY: number;
  yTicks: YTick[];
  xs: number[];
}

export interface LineOptions {
  yDomain?: Domain;
  tickCount?: number;
}

/**
 * Geometria da curva do resultado acumulado. A curva é monótona entre pontos (`curveMonotoneX`):
 * nunca cria um pico ou vale que não esteja nos dados.
 */
export function cumulativeLine(
  values: readonly number[],
  box: ChartBox,
  options: LineOptions = {},
): CumulativeLine {
  const { width, height, padding } = box;
  const innerW = width - padding.left - padding.right;
  const axis = buildYAxis(values, [padding.top, height - padding.bottom], options);
  const n = values.length;

  const xOf = (i: number) =>
    round2(n === 1 ? padding.left + innerW / 2 : padding.left + (i * innerW) / (n - 1));
  const xs = values.map((_, i) => xOf(i));
  const points = values.map((value, i) => ({ x: xOf(i), y: round2(axis.scale(value)), value }));

  const linePath = line<LinePoint>()
    .x((p) => p.x)
    .y((p) => p.y)
    .curve(curveMonotoneX)
    .digits(2)(points);
  const areaPath = area<LinePoint>()
    .x((p) => p.x)
    .y0(axis.zeroY)
    .y1((p) => p.y)
    .curve(curveMonotoneX)
    .digits(2)(points);

  return {
    points,
    linePath: linePath ?? '',
    areaAbovePath: areaPath ?? '',
    areaBelowPath: areaPath ?? '',
    zeroY: axis.zeroY,
    yTicks: axis.yTicks,
    xs,
  };
}

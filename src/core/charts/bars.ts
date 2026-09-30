import { buildYAxis, round2, type ChartBox, type Domain, type YTick } from './scales';

export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  sign: 'positive' | 'negative' | 'zero';
  rx: number;
}

export interface SignedBars {
  bars: Bar[];
  zeroY: number;
  yTicks: YTick[];
  centers: number[];
  /** Índices do maior e do menor valor (-1 se não há dados). */
  extremes: { maxIndex: number; minIndex: number };
}

export interface BarsOptions {
  bandRatio?: number;
  radius?: number;
  yDomain?: Domain;
  tickCount?: number;
}

/** Barras com sinal que crescem a partir da linha do zero; altura exatamente proporcional ao valor. */
export function signedBars(values: readonly number[], box: ChartBox, options: BarsOptions = {}): SignedBars {
  const { width, height, padding } = box;
  const bandRatio = options.bandRatio ?? 0.6;
  const radius = options.radius ?? 4;
  const innerW = width - padding.left - padding.right;
  const axis = buildYAxis(values, [padding.top, height - padding.bottom], options);
  const band = innerW / Math.max(values.length, 1);
  const barWidth = band * bandRatio;

  const bars = values.map((value, i): Bar => {
    const y = axis.scale(value);
    const h = Math.abs(axis.zeroY - y);
    const sign = value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
    return {
      x: round2(padding.left + i * band + (band - barWidth) / 2),
      y: round2(value >= 0 ? y : axis.zeroY),
      width: round2(barWidth),
      height: round2(h),
      value,
      sign,
      rx: round2(Math.max(0, Math.min(radius, barWidth / 2, h / 2))),
    };
  });

  let maxIndex = -1;
  let minIndex = -1;
  let maxValue = -Infinity;
  let minValue = Infinity;
  values.forEach((value, i) => {
    if (value > maxValue) {
      maxValue = value;
      maxIndex = i;
    }
    if (value < minValue) {
      minValue = value;
      minIndex = i;
    }
  });

  return {
    bars,
    zeroY: axis.zeroY,
    yTicks: axis.yTicks,
    centers: values.map((_, i) => round2(padding.left + (i + 0.5) * band)),
    extremes: { maxIndex, minIndex },
  };
}

import { scaleLinear } from 'd3-scale';

/*
 * Escalas e marcas de eixo em funções simples (sem DOM), partilhadas pelos gráficos.
 */

export type Domain = readonly [number, number];
export interface YTick {
  value: number;
  y: number;
}

/** Normaliza -0 para 0 e arredonda a 2 casas decimais (saída estável para snapshots). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}

/**
 * Marcas "bonitas" (passos 1, 2, 5 × 10ⁿ) que cobrem `[min, max]`.
 * Se o domínio atravessa o zero, o 0 está sempre incluído (os extremos são múltiplos do passo).
 */
export function niceTicks(min: number, max: number, count: number): number[] {
  return scaleLinear()
    .domain([Math.min(min, max), Math.max(min, max)])
    .nice(count)
    .ticks(count)
    .map((t) => t + 0);
}

/** Domínio arredondado às marcas de `niceTicks`. */
export function niceDomain(min: number, max: number, count: number): [number, number] {
  const [a, b] = scaleLinear()
    .domain([Math.min(min, max), Math.max(min, max)])
    .nice(count)
    .domain() as [number, number];
  return [a + 0, b + 0];
}

/** Escala linear do domínio para `[top, bottom]` (o valor máximo fica em `top`). Domínio degenerado → meio. */
export function yScale(domain: Domain, range: readonly [number, number]): (value: number) => number {
  const [d0, d1] = domain;
  const [top, bottom] = range;
  const span = d1 - d0;
  return (value) => (span === 0 ? (top + bottom) / 2 : bottom - ((value - d0) / span) * (bottom - top));
}

export interface YAxis {
  domain: [number, number];
  scale: (value: number) => number;
  zeroY: number;
  yTicks: YTick[];
}

/**
 * Eixo vertical para uma série: o domínio inclui sempre o 0, salvo se `yDomain` o fixar.
 * Séries vazias ou só de zeros usam ±100 cêntimos para o eixo não colapsar.
 */
export function buildYAxis(
  values: readonly number[],
  range: readonly [number, number],
  options: { yDomain?: Domain | undefined; tickCount?: number | undefined } = {},
): YAxis {
  const tickCount = options.tickCount ?? 5;
  let domain: [number, number];
  if (options.yDomain) {
    domain = [options.yDomain[0], options.yDomain[1]];
  } else {
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    domain = lo === hi ? [-100, 100] : niceDomain(lo, hi, tickCount);
  }
  const scale = yScale(domain, range);
  const yTicks = niceTicks(domain[0], domain[1], tickCount)
    .filter((v) => v >= domain[0] && v <= domain[1])
    .map((value) => ({ value, y: round2(scale(value)) }));
  return { domain, scale, zeroY: round2(scale(0)), yTicks };
}

export interface ChartBox {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

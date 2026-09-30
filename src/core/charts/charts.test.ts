import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import type { IsoDate, MonthKey } from '../types';
import {
  buildYAxis,
  calendarGrid,
  cumulativeLine,
  niceDomain,
  niceTicks,
  round2,
  signedBars,
  yScale,
} from './index';
import type { HeatDay } from './index';

const cents = (euros: number[]) => euros.map((e) => Math.round(e * 100));
const CUMULATIVE = cents([120, 35, -175, -130, -290, 20, -75, -215, -155, -415, -380, -664.5]);
const MONTHLY = cents([120, -85, -210, 45, -160, 310, -95, -140, 60, -260, 35, -284.5]);
const BOX = { width: 600, height: 300, padding: { top: 20, right: 30, bottom: 30, left: 50 } };

interface Seg {
  from: [number, number];
  to: [number, number];
  c1?: [number, number];
  c2?: [number, number];
}

/** Lê os segmentos de um caminho `M…` / `C…` / `L…` produzido por d3-shape. */
function parsePath(d: string): Seg[] {
  const segs: Seg[] = [];
  let cur: [number, number] = [0, 0];
  for (const m of d.matchAll(/([MLC])([^MLCZ]*)/g)) {
    const n = (m[2] ?? '').split(',').map(Number);
    if (m[1] === 'M') cur = [n[0] ?? 0, n[1] ?? 0];
    else if (m[1] === 'L') {
      const to: [number, number] = [n[0] ?? 0, n[1] ?? 0];
      segs.push({ from: cur, to });
      cur = to;
    } else {
      const to: [number, number] = [n[4] ?? 0, n[5] ?? 0];
      segs.push({ from: cur, to, c1: [n[0] ?? 0, n[1] ?? 0], c2: [n[2] ?? 0, n[3] ?? 0] });
      cur = to;
    }
  }
  return segs;
}

describe('scales', () => {
  it('niceTicks inclui o 0 quando o domínio atravessa o zero', () => {
    for (const [min, max] of [
      [-66450, 12000],
      [-7, 93],
      [-1, 1],
      [-100000, 500],
    ] as const) {
      const ticks = niceTicks(min, max, 5);
      expect(ticks).toContain(0);
      expect(ticks[0]).toBeLessThanOrEqual(min);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks.some((t) => Object.is(t, -0))).toBe(false);
    }
  });

  it('niceTicks aceita extremos trocados e niceDomain cobre os dados', () => {
    expect(niceTicks(50, -50, 4)).toEqual(niceTicks(-50, 50, 4));
    const [a, b] = niceDomain(-66450, 12000, 5);
    expect(a).toBeLessThanOrEqual(-66450);
    expect(b).toBeGreaterThanOrEqual(12000);
    expect(niceDomain(9, -3, 5)).toEqual(niceDomain(-3, 9, 5));
  });

  it('yScale mapeia o máximo para o topo e o mínimo para o fundo', () => {
    const y = yScale([-100, 100], [10, 110]);
    expect(y(100)).toBe(10);
    expect(y(-100)).toBe(110);
    expect(y(0)).toBe(60);
    expect(yScale([5, 5], [0, 100])(5)).toBe(50);
  });

  it('round2 arredonda e normaliza -0', () => {
    expect(round2(1.005 + 0.0001)).toBe(1.01);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });

  it('buildYAxis: séries vazias ou de zeros não colapsam, yDomain fixo é respeitado', () => {
    expect(buildYAxis([], [0, 100]).domain).toEqual([-100, 100]);
    expect(buildYAxis([0, 0], [0, 100]).zeroY).toBe(50);
    const fixed = buildYAxis([1], [0, 100], { yDomain: [-1000, 1000], tickCount: 4 });
    expect(fixed.domain).toEqual([-1000, 1000]);
    expect(fixed.yTicks.every((t) => t.value >= -1000 && t.value <= 1000)).toBe(true);
    expect(fixed.yTicks.find((t) => t.value === 0)?.y).toBe(50);
  });

  it('buildYAxis filtra marcas fora de um yDomain não arredondado', () => {
    const axis = buildYAxis([], [0, 100], { yDomain: [-130, 130] });
    expect(axis.yTicks.every((t) => Math.abs(t.value) <= 130)).toBe(true);
  });
});

describe('cumulativeLine', () => {
  const r = cumulativeLine(CUMULATIVE, BOX);

  it('tem um ponto por passo e x uniformes entre as margens', () => {
    expect(r.points).toHaveLength(12);
    expect(r.xs[0]).toBe(50);
    expect(r.xs[11]).toBe(570);
    expect(r.points.map((p) => p.value)).toEqual(CUMULATIVE);
    const gaps = r.xs.slice(1).map((x, i) => x - (r.xs[i] ?? 0));
    for (const g of gaps) expect(g).toBeCloseTo(520 / 11, 1);
  });

  it('o eixo inclui o zero e as marcas incluem 0 na linha zeroY', () => {
    const zero = r.yTicks.find((t) => t.value === 0);
    expect(zero?.y).toBe(r.zeroY);
    expect(r.zeroY).toBeGreaterThan(20);
    expect(r.zeroY).toBeLessThan(270);
  });

  it('valores positivos ficam acima do zero e negativos abaixo', () => {
    for (const p of r.points) {
      if (p.value > 0) expect(p.y).toBeLessThan(r.zeroY);
      if (p.value < 0) expect(p.y).toBeGreaterThan(r.zeroY);
    }
  });

  it('a curva é monótona: cada segmento fica no intervalo y dos seus extremos', () => {
    const segs = parsePath(r.linePath);
    expect(segs).toHaveLength(11);
    const eps = 0.011; // arredondamento a 2 casas
    for (const s of segs) {
      const lo = Math.min(s.from[1], s.to[1]) - eps;
      const hi = Math.max(s.from[1], s.to[1]) + eps;
      for (const c of [s.c1, s.c2]) {
        expect(c?.[1]).toBeGreaterThanOrEqual(lo);
        expect(c?.[1]).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('a curva passa exatamente pelos pontos e as áreas fecham na linha do zero', () => {
    const segs = parsePath(r.linePath);
    expect(segs.map((s) => s.to)).toEqual(r.points.slice(1).map((p) => [p.x, p.y]));
    for (const path of [r.areaAbovePath, r.areaBelowPath]) {
      expect(path.endsWith('Z')).toBe(true);
      expect(path).toContain(`${r.zeroY}`);
      const s = parsePath(path);
      // a base da área está em zeroY (primeiro e último vértices)
      expect(s[s.length - 1]?.to[1]).toBe(r.zeroY);
      expect(s[0]?.from[1]).toBe(r.points[0]?.y);
    }
  });

  it('cruza o zero entre pontos de sinais opostos', () => {
    const crossings = r.points.filter(
      (p, i) => i > 0 && Math.sign(p.value) !== Math.sign(r.points[i - 1]?.value ?? 0),
    );
    expect(crossings.length).toBeGreaterThanOrEqual(2);
  });

  it('0 pontos: tudo vazio mas com eixo', () => {
    const e = cumulativeLine([], BOX);
    expect(e.points).toEqual([]);
    expect(e.linePath).toBe('');
    expect(e.areaAbovePath).toBe('');
    expect(e.xs).toEqual([]);
    expect(e.yTicks.length).toBeGreaterThan(0);
  });

  it('1 ponto: centrado na horizontal', () => {
    const one = cumulativeLine([5000], BOX);
    expect(one.xs).toEqual([310]);
    expect(one.points).toHaveLength(1);
    expect(one.linePath.startsWith('M310')).toBe(true);
  });

  it('2 pontos: um único segmento reto', () => {
    const two = cumulativeLine([1000, -2000], BOX);
    const segs = parsePath(two.linePath);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.from).toEqual([50, two.points[0]?.y]);
    expect(segs[0]?.to).toEqual([570, two.points[1]?.y]);
  });

  it('só positivos e só negativos mantêm o zero no domínio', () => {
    const pos = cumulativeLine(cents([10, 20, 30]), BOX);
    expect(pos.zeroY).toBe(270); // zero no fundo
    expect(pos.yTicks.some((t) => t.value === 0)).toBe(true);
    const neg = cumulativeLine(cents([-10, -20, -30]), BOX);
    expect(neg.zeroY).toBe(20); // zero no topo
    expect(neg.points.every((p) => p.y > neg.zeroY)).toBe(true);
  });

  it('respeita yDomain e tickCount', () => {
    const fixed = cumulativeLine(cents([10, -10]), BOX, { yDomain: [-50000, 50000], tickCount: 2 });
    expect(fixed.zeroY).toBe(145);
    expect(fixed.yTicks.length).toBeLessThanOrEqual(3);
  });
});

describe('signedBars', () => {
  const r = signedBars(MONTHLY, BOX);

  it('uma barra por valor, com sinal e valor corretos', () => {
    expect(r.bars).toHaveLength(12);
    r.bars.forEach((b, i) => {
      expect(b.value).toBe(MONTHLY[i]);
      expect(b.sign).toBe((MONTHLY[i] ?? 0) > 0 ? 'positive' : 'negative');
    });
  });

  it('as barras crescem a partir da linha do zero', () => {
    for (const b of r.bars) {
      if (b.sign === 'positive') expect(b.y + b.height).toBeCloseTo(r.zeroY, 1);
      else expect(b.y).toBe(r.zeroY);
    }
  });

  it('alturas exatamente proporcionais aos valores', () => {
    const ratio = (r.bars[0]?.height ?? 0) / Math.abs(MONTHLY[0] ?? 1);
    for (const b of r.bars) expect(b.height / Math.abs(b.value)).toBeCloseTo(ratio, 3);
  });

  it('zero → altura 0, sinal zero e sem raio', () => {
    const z = signedBars([0, 500, 0], BOX);
    expect(z.bars[0]).toMatchObject({ height: 0, sign: 'zero', rx: 0 });
    expect(z.bars[2]?.height).toBe(0);
    expect(z.bars[1]?.sign).toBe('positive');
  });

  it('extremos e centros', () => {
    expect(r.extremes).toEqual({ maxIndex: 5, minIndex: 11 });
    expect(r.centers).toHaveLength(12);
    r.bars.forEach((b, i) => {
      expect(b.x + b.width / 2).toBeCloseTo(r.centers[i] ?? 0, 1);
    });
    expect(r.yTicks.find((t) => t.value === 0)?.y).toBe(r.zeroY);
  });

  it('bandRatio e radius configuráveis; raio limitado pela geometria', () => {
    const narrow = signedBars([1000, 1], BOX, { bandRatio: 0.5, radius: 100 });
    const b0 = narrow.bars[0];
    expect(b0?.width).toBe(130);
    expect(b0?.rx).toBeLessThanOrEqual(65);
    expect(narrow.bars[1]?.rx).toBeLessThanOrEqual((narrow.bars[1]?.height ?? 0) / 2 + 0.01);
  });

  it('vazio: sem barras, extremos -1', () => {
    const e = signedBars([], BOX);
    expect(e.bars).toEqual([]);
    expect(e.centers).toEqual([]);
    expect(e.extremes).toEqual({ maxIndex: -1, minIndex: -1 });
  });

  it('yDomain e tickCount', () => {
    const f = signedBars([100], BOX, { yDomain: [-1000, 1000], tickCount: 4 });
    expect(f.zeroY).toBe(145);
  });
});

function daysFrom(start: IsoDate, end: IsoDate): HeatDay[] {
  const out: HeatDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push({ date: d, level: 0 });
  return out;
}

describe('calendarGrid', () => {
  const opts = { cell: 10, gap: 2, weekStart: 'monday' } as const;
  const grid = calendarGrid(daysFrom('2025-10-01' as IsoDate, '2026-09-30' as IsoDate), opts);

  it('Out 2025 → Set 2026: 365 células em 53 colunas', () => {
    expect(grid.cells).toHaveLength(365);
    expect(grid.columns).toBe(53);
    expect(grid.width).toBe(53 * 12 - 2);
    expect(grid.height).toBe(7 * 12 - 2);
  });

  it('quarta 2025-10-01 começa na linha 2, coluna 0', () => {
    expect(grid.cells[0]).toMatchObject({ date: '2025-10-01', row: 2, column: 0, x: 0, y: 24 });
    expect(grid.cells[5]).toMatchObject({ date: '2025-10-06', row: 0, column: 1, x: 12, y: 0 });
  });

  it('rótulos de mês na coluna do dia 1', () => {
    expect(grid.monthLabels).toHaveLength(12);
    expect(grid.monthLabels[0]).toEqual({ x: 0, month: '2025-10' as MonthKey });
    // 1 nov 2025 (sábado): 33.º dia após segunda 29 set → coluna 4
    expect(grid.monthLabels[1]).toEqual({ x: 4 * 12, month: '2025-11' as MonthKey });
    expect(grid.monthLabels[11]?.month).toBe('2026-09');
    const xs = grid.monthLabels.map((m) => m.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('preserva o nível e aceita dias fora de ordem', () => {
    const g = calendarGrid(
      [
        { date: '2025-10-08' as IsoDate, level: 3 },
        { date: '2025-10-01' as IsoDate, level: 1 },
      ],
      opts,
    );
    expect(g.cells[0]).toMatchObject({ level: 3, column: 1, row: 2 });
    expect(g.cells[1]).toMatchObject({ level: 1, column: 0, row: 2 });
    expect(g.columns).toBe(2);
  });

  it('sem dias → grelha vazia', () => {
    expect(calendarGrid([], opts)).toEqual({ cells: [], columns: 0, width: 0, height: 0, monthLabels: [] });
  });

  it('domingo fica na linha 6 da mesma coluna da segunda', () => {
    const g = calendarGrid(daysFrom('2025-10-06' as IsoDate, '2025-10-12' as IsoDate), opts);
    expect(g.columns).toBe(1);
    expect(g.cells.map((c) => c.row)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(g.monthLabels).toEqual([]);
  });
});

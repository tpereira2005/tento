import {
  addDays,
  addMonths,
  addMonthsToDate,
  daysBetween,
  firstDayOfMonth,
  lastDayOfMonth,
  monthOf,
  monthRange,
  monthsBetween,
} from '../dates';
import type { Cents, IsoDate, MonthKey, Transaction } from '../types';
import type { MonthlyPoint } from './monthly';

export interface Period {
  from: IsoDate;
  to: IsoDate;
}

export interface SummaryLite {
  depositedCents: Cents;
  withdrawnCents: Cents;
  netCents: Cents;
  depositCount: number;
  withdrawalCount: number;
}

export interface Delta {
  /** a − b, em cêntimos (ou em unidades, para contagens). */
  absolute: number;
  /** (a − b) / |b|; null quando b é 0. */
  ratio: number | null;
}

export interface PeriodComparison {
  a: SummaryLite;
  b: SummaryLite;
  deltas: {
    depositedCents: Delta;
    withdrawnCents: Delta;
    netCents: Delta;
    depositCount: Delta;
    withdrawalCount: Delta;
  };
}

function summarizePeriod(txns: readonly Transaction[], period: Period): SummaryLite {
  const s: SummaryLite = {
    depositedCents: 0,
    withdrawnCents: 0,
    netCents: 0,
    depositCount: 0,
    withdrawalCount: 0,
  };
  for (const t of txns) {
    if (t.date < period.from || t.date > period.to) continue;
    if (t.type === 'deposit') {
      s.depositedCents += t.amountCents;
      s.depositCount += 1;
    } else {
      s.withdrawnCents += t.amountCents;
      s.withdrawalCount += 1;
    }
  }
  s.netCents = s.withdrawnCents - s.depositedCents;
  return s;
}

export const delta = (a: number, b: number): Delta => ({
  absolute: a - b,
  ratio: b === 0 ? null : (a - b) / Math.abs(b),
});

/** Compara o período `a` (atual) com `b` (referência). Os deltas são `a − b`. */
export function comparePeriods(txns: readonly Transaction[], a: Period, b: Period): PeriodComparison {
  const sa = summarizePeriod(txns, a);
  const sb = summarizePeriod(txns, b);
  return {
    a: sa,
    b: sb,
    deltas: {
      depositedCents: delta(sa.depositedCents, sb.depositedCents),
      withdrawnCents: delta(sa.withdrawnCents, sb.withdrawnCents),
      netCents: delta(sa.netCents, sb.netCents),
      depositCount: delta(sa.depositCount, sb.depositCount),
      withdrawalCount: delta(sa.withdrawalCount, sb.withdrawalCount),
    },
  };
}

/** Período com a mesma duração (em dias) imediatamente antes de `period`. */
export function previousPeriod(period: Period): Period {
  const length = daysBetween(period.from, period.to) + 1;
  return { from: addDays(period.from, -length), to: addDays(period.from, -1) };
}

/** O mesmo período um ano antes: as duas datas recuam 12 meses (29 fev → 28 fev em anos não bissextos). */
export function samePeriodLastYear(period: Period): Period {
  return { from: addMonthsToDate(period.from, -12), to: addMonthsToDate(period.to, -12) };
}

/**
 * Os mesmos meses de calendário imediatamente antes de `period` (do 1.º dia do mês de `from` até ao fim do
 * mês anterior): `nov 2025 – out 2026` → `nov 2024 – out 2025`. Dá séries mensais com o mesmo número de meses.
 */
export function previousMonthsPeriod(period: Period): Period {
  const first = monthOf(period.from);
  const count = monthsBetween(first, monthOf(period.to)) + 1;
  return {
    from: firstDayOfMonth(addMonths(first, -count)),
    to: lastDayOfMonth(addMonths(first, -1)),
  };
}

export type MonthFlow = Omit<MonthlyPoint, 'month'>;

const zeroFlow = (cumulativeCents: Cents): MonthFlow => ({
  depositedCents: 0,
  withdrawnCents: 0,
  netCents: 0,
  cumulativeCents,
  depositCount: 0,
  withdrawalCount: 0,
});

/**
 * Série mensal com todos os meses de `from` a `to`: os que faltam ficam a zeros e o acumulado mantém o último
 * valor conhecido (0 antes do primeiro ponto). Pontos fora do intervalo são ignorados.
 */
export function fillMonths(points: readonly MonthlyPoint[], from: MonthKey, to: MonthKey): MonthlyPoint[] {
  const sorted = [...points].sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0));
  let cursor = 0;
  let carry = 0;
  return monthRange(from, to).map((month) => {
    let found: MonthlyPoint | undefined;
    for (;;) {
      const next = sorted[cursor];
      if (!next || next.month > month) break;
      carry = next.cumulativeCents;
      if (next.month === month) found = next;
      cursor += 1;
    }
    return found ?? { month, ...zeroFlow(carry) };
  });
}

export interface AlignedMonth {
  /** Posição (0 = 1.º mês de cada série). */
  index: number;
  /** Mês de calendário de cada lado; `null` só se esse lado não tem nenhum mês. */
  monthA: MonthKey | null;
  monthB: MonthKey | null;
  a: MonthFlow;
  b: MonthFlow;
}

function contiguous(points: readonly MonthlyPoint[]): MonthlyPoint[] {
  const months = points.map((p) => p.month).sort();
  const first = months[0];
  const last = months[months.length - 1];
  return first !== undefined && last !== undefined ? fillMonths(points, first, last) : [];
}

function flowAt(series: readonly MonthlyPoint[], index: number): { month: MonthKey | null; flow: MonthFlow } {
  const point = series[index];
  if (point) {
    const { month, ...flow } = point;
    return { month, flow };
  }
  const last = series[series.length - 1];
  if (!last) return { month: null, flow: zeroFlow(0) };
  return { month: addMonths(last.month, index - (series.length - 1)), flow: zeroFlow(last.cumulativeCents) };
}

/**
 * Alinha duas séries mensais pela posição (mês 1 com mês 1, mês 2 com mês 2…), para comparar períodos que
 * não coincidem no calendário. Meses em falta (buracos dentro de uma série ou o fim da série mais curta)
 * ficam a zeros, com o acumulado a manter o último valor; uma série vazia fica toda a zeros.
 */
export function monthlyAligned(a: readonly MonthlyPoint[], b: readonly MonthlyPoint[]): AlignedMonth[] {
  const sa = contiguous(a);
  const sb = contiguous(b);
  const length = Math.max(sa.length, sb.length);
  return Array.from({ length }, (_, index) => {
    const x = flowAt(sa, index);
    const y = flowAt(sb, index);
    return { index, monthA: x.month, monthB: y.month, a: x.flow, b: y.flow };
  });
}

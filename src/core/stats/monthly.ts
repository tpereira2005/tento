import { monthOf, monthRange, monthsBetween } from '../dates';
import type { Cents, MonthKey, Transaction } from '../types';

export interface MonthlyPoint {
  month: MonthKey;
  depositedCents: Cents;
  withdrawnCents: Cents;
  /** levantado − depositado */
  netCents: Cents;
  /** Resultado líquido acumulado até este mês, inclusive. */
  cumulativeCents: Cents;
  depositCount: number;
  withdrawalCount: number;
}

export interface MonthBounds {
  from?: MonthKey;
  to?: MonthKey;
}

/**
 * Série mensal com TODOS os meses de calendário do primeiro ao último (ou dentro dos limites),
 * meses sem movimentos a zeros. Transações fora dos limites são ignoradas.
 * Sem transações e sem ambos os limites devolve [].
 */
export function monthlySeries(txns: readonly Transaction[], bounds: MonthBounds = {}): MonthlyPoint[] {
  let first: MonthKey | undefined;
  let last: MonthKey | undefined;
  for (const t of txns) {
    const m = monthOf(t.date);
    if (first === undefined || m < first) first = m;
    if (last === undefined || m > last) last = m;
  }
  const from = bounds.from ?? first;
  const to = bounds.to ?? last;
  if (from === undefined || to === undefined) return [];

  const points: MonthlyPoint[] = monthRange(from, to).map((month) => ({
    month,
    depositedCents: 0,
    withdrawnCents: 0,
    netCents: 0,
    cumulativeCents: 0,
    depositCount: 0,
    withdrawalCount: 0,
  }));
  for (const t of txns) {
    const p = points[monthsBetween(from, monthOf(t.date))];
    if (!p) continue;
    if (t.type === 'deposit') {
      p.depositedCents += t.amountCents;
      p.depositCount += 1;
    } else {
      p.withdrawnCents += t.amountCents;
      p.withdrawalCount += 1;
    }
  }
  let running = 0;
  for (const p of points) {
    p.netCents = p.withdrawnCents - p.depositedCents;
    running += p.netCents;
    p.cumulativeCents = running;
  }
  return points;
}

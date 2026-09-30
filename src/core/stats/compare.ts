import { addDays, daysBetween } from '../dates';
import type { Cents, IsoDate, Transaction } from '../types';

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

const delta = (a: number, b: number): Delta => ({
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

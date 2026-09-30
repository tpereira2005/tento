import { daysBetween } from '../dates';
import type { Cents, IsoDate, MonthKey, Transaction } from '../types';
import { monthlySeries } from './monthly';

export interface MonthResult {
  month: MonthKey;
  netCents: Cents;
}

export interface LastDeposit {
  date: IsoDate;
  amountCents: Cents;
}

export interface Summary {
  depositedCents: Cents;
  withdrawnCents: Cents;
  netCents: Cents;
  depositCount: number;
  withdrawalCount: number;
  /** levantado / depositado (razão, não dinheiro); null quando não há depósitos. */
  withdrawnRatio: number | null;
  /** Meses de calendário no intervalo, incluindo os vazios. */
  months: number;
  positiveMonths: number;
  negativeMonths: number;
  zeroMonths: number;
  /** Resultado líquido médio por mês, arredondado (metade afasta-se de zero) para cêntimos inteiros. */
  avgMonthlyNetCents: Cents;
  /** Melhor mês (empates: o mais antigo). */
  bestMonth: MonthResult | null;
  /** Pior mês (empates: o mais antigo). */
  worstMonth: MonthResult | null;
  lastDeposit: LastDeposit | null;
  daysSinceLastDeposit: number | null;
}

export interface SummaryOptions {
  today: IsoDate;
  from?: MonthKey;
  to?: MonthKey;
}

/** Divisão inteira arredondada com metade a afastar-se de zero. */
export function divRoundHalfAwayFromZero(numerator: number, denominator: number): number {
  const q = Math.abs(numerator) / Math.abs(denominator);
  const rounded = Math.floor(q + 0.5);
  const negative = numerator < 0 !== denominator < 0;
  return negative && rounded !== 0 ? -rounded : rounded;
}

export function summarize(txns: readonly Transaction[], options: SummaryOptions): Summary {
  const bounds = {
    ...(options.from !== undefined ? { from: options.from } : {}),
    ...(options.to !== undefined ? { to: options.to } : {}),
  };
  const series = monthlySeries(txns, bounds);
  const first = series[0]?.month;
  const last = series[series.length - 1]?.month;

  let depositedCents = 0;
  let withdrawnCents = 0;
  let depositCount = 0;
  let withdrawalCount = 0;
  let positiveMonths = 0;
  let negativeMonths = 0;
  let zeroMonths = 0;
  let bestMonth: MonthResult | null = null;
  let worstMonth: MonthResult | null = null;
  for (const p of series) {
    depositedCents += p.depositedCents;
    withdrawnCents += p.withdrawnCents;
    depositCount += p.depositCount;
    withdrawalCount += p.withdrawalCount;
    if (p.netCents > 0) positiveMonths++;
    else if (p.netCents < 0) negativeMonths++;
    else zeroMonths++;
    if (bestMonth === null || p.netCents > bestMonth.netCents)
      bestMonth = { month: p.month, netCents: p.netCents };
    if (worstMonth === null || p.netCents < worstMonth.netCents)
      worstMonth = { month: p.month, netCents: p.netCents };
  }

  let lastDeposit: (LastDeposit & { seq: number }) | null = null;
  for (const t of txns) {
    if (t.type !== 'deposit') continue;
    const m = t.date.slice(0, 7);
    if (first === undefined || last === undefined || m < first || m > last) continue;
    if (
      lastDeposit === null ||
      t.date > lastDeposit.date ||
      (t.date === lastDeposit.date && t.seq > lastDeposit.seq)
    ) {
      lastDeposit = { date: t.date, amountCents: t.amountCents, seq: t.seq };
    }
  }

  const netCents = withdrawnCents - depositedCents;
  const months = series.length;
  return {
    depositedCents,
    withdrawnCents,
    netCents,
    depositCount,
    withdrawalCount,
    withdrawnRatio: depositedCents === 0 ? null : withdrawnCents / depositedCents,
    months,
    positiveMonths,
    negativeMonths,
    zeroMonths,
    avgMonthlyNetCents: months === 0 ? 0 : divRoundHalfAwayFromZero(netCents, months),
    bestMonth,
    worstMonth,
    lastDeposit: lastDeposit ? { date: lastDeposit.date, amountCents: lastDeposit.amountCents } : null,
    daysSinceLastDeposit: lastDeposit ? daysBetween(lastDeposit.date, options.today) : null,
  };
}

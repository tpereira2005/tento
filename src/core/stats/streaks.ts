import type { MonthKey, Transaction } from '../types';
import { monthlySeries, type MonthBounds, type MonthlyPoint } from './monthly';

export type StreakSign = 'positive' | 'negative' | 'zero';

export interface Streak {
  sign: StreakSign;
  /** Número de meses de calendário seguidos. */
  length: number;
  start: MonthKey;
  end: MonthKey;
}

export interface Streaks {
  /** Sequência que termina no último mês; null sem meses. */
  current: Streak | null;
  /** Maior sequência de meses positivos (empates: a mais antiga); null se não existir. */
  longestPositive: Streak | null;
  longestNegative: Streak | null;
}

const signOf = (p: MonthlyPoint): StreakSign =>
  p.netCents > 0 ? 'positive' : p.netCents < 0 ? 'negative' : 'zero';

/** Sequências de meses consecutivos com o mesmo sinal. Meses a zero interrompem as sequências. */
export function computeStreaks(txns: readonly Transaction[], bounds: MonthBounds = {}): Streaks {
  const series = monthlySeries(txns, bounds);
  const runs: Streak[] = [];
  for (const p of series) {
    const sign = signOf(p);
    const run = runs[runs.length - 1];
    if (run?.sign === sign) {
      run.length += 1;
      run.end = p.month;
    } else {
      runs.push({ sign, length: 1, start: p.month, end: p.month });
    }
  }
  const longest = (sign: StreakSign): Streak | null => {
    let best: Streak | null = null;
    for (const r of runs) if (r.sign === sign && (best === null || r.length > best.length)) best = r;
    return best;
  };
  return {
    current: runs[runs.length - 1] ?? null,
    longestPositive: longest('positive'),
    longestNegative: longest('negative'),
  };
}

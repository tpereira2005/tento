import type { HeatLevel } from '../types';
import { addDays, daysBetween } from '../dates';
import type { Cents, IsoDate, Transaction } from '../types';

export type { HeatLevel } from '../types';

export interface DayCell {
  date: IsoDate;
  depositedCents: Cents;
  level: HeatLevel;
}

/** Percentil por posição mais próxima (nearest-rank) sobre valores ordenados. */
function nearestRank(sorted: readonly number[], p: number): number {
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

/**
 * Depósitos por dia, para todos os dias do intervalo (inclusivo).
 * Nível 0 = sem depósitos; 1–4 pelos quartis dos totais diários não nulos do intervalo.
 * Se todos os totais não nulos forem iguais, o nível é 2.
 */
export function depositHeatmap(
  txns: readonly Transaction[],
  range: { from: IsoDate; to: IsoDate },
): DayCell[] {
  const count = daysBetween(range.from, range.to) + 1;
  if (count <= 0) return [];
  const totals = new Map<IsoDate, Cents>();
  for (const t of txns) {
    if (t.type !== 'deposit' || t.date < range.from || t.date > range.to) continue;
    totals.set(t.date, (totals.get(t.date) ?? 0) + t.amountCents);
  }
  const sorted = [...totals.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const q1 = nearestRank(sorted, 0.25);
  const q2 = nearestRank(sorted, 0.5);
  const q3 = nearestRank(sorted, 0.75);

  const levelOf = (v: number): HeatLevel => {
    if (v <= 0) return 0;
    if (min === max) return 2;
    if (v <= q1) return 1;
    if (v <= q2) return 2;
    if (v <= q3) return 3;
    return 4;
  };

  const cells: DayCell[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(range.from, i);
    const depositedCents = totals.get(date) ?? 0;
    cells.push({ date, depositedCents, level: levelOf(depositedCents) });
  }
  return cells;
}

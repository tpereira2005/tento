import { formatPercent, type MonthKey, type MonthlyPoint } from '../../../core';
import { t } from '../../i18n';

export const MINUS = String.fromCharCode(0x2212);
export const EN_DASH = String.fromCharCode(0x2013);

/** Substitui `{chave}` no texto pelos valores indicados. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1;

/** `2026-09` → `setembro`. */
export function monthName(month: string): string {
  return t().dashboard.monthsLong[monthIndex(month)] ?? month;
}

/** `2026-09` → `set`. */
export function monthAbbr(month: string): string {
  return t().charts.monthsShort[monthIndex(month)] ?? month;
}

/** `2026-09` → `set 2026`. */
export function monthLabel(month: string): string {
  return `${monthAbbr(month)} ${month.slice(0, 4)}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `out 2025 – set 2026`, ou só `set 2026` quando há um único mês; `null` sem meses. */
export function periodSpan(monthly: readonly MonthlyPoint[]): string | null {
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  if (!first || !last) return null;
  return first.month === last.month
    ? monthLabel(first.month)
    : `${monthLabel(first.month)} ${EN_DASH} ${monthLabel(last.month)}`;
}

/**
 * Se a série acaba abaixo de zero, o mês a seguir ao último em que esteve em zero ou acima
 * (a série começa em zero: se nunca esteve acima, é o primeiro mês). `null` se acaba em zero ou acima.
 */
export function belowZeroSince(points: readonly MonthlyPoint[]): MonthKey | null {
  const last = points[points.length - 1];
  if (!last || last.cumulativeCents >= 0) return null;
  let lastNonNegative = -1;
  points.forEach((p, i) => {
    if (p.cumulativeCents >= 0) lastNonNegative = i;
  });
  return points[lastNonNegative + 1]?.month ?? null;
}

/** Percentagem inteira para partilhas ("86 %"). */
export function formatShare(share: number): string {
  return formatPercent(Math.round(share * 100) / 100);
}

/** `+63,5 %` / `−25 %`. */
export function signedPercent(ratio: number): string {
  const sign = ratio > 0 ? '+' : ratio < 0 ? MINUS : '';
  return `${sign}${formatPercent(Math.abs(ratio))}`;
}

/** `2026-03-14T10:00:00.000Z` → `14/03/2026` (a data civil em UTC, sem passar por `Date`). */
export function isoDateOfTimestamp(timestamp: string): string {
  return `${timestamp.slice(8, 10)}/${timestamp.slice(5, 7)}/${timestamp.slice(0, 4)}`;
}

export function plural(one: string, many: string, n: number): string {
  return n === 1 ? one : fill(many, { n });
}

import { err, ok, type IsoDate, type MonthKey, type Result } from './types';

/*
 * Datas de calendário como texto. É o único ficheiro de src/core que pode usar `Date`, e só em UTC
 * (a regra de lint proíbe `getMonth()`, `getDate()` e afins em hora local, que causavam o dia 1 do mês
 * a saltar para o mês anterior nas versões antigas).
 */

export type DateError = 'empty' | 'invalid_format' | 'invalid_date';

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function makeIsoDate(year: number, month: number, day: number): Result<IsoDate, DateError> {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) return err('invalid_date');
  if (!Number.isInteger(month) || month < 1 || month > 12) return err('invalid_date');
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return err('invalid_date');
  return ok(`${pad(year, 4)}-${pad(month)}-${pad(day)}` as IsoDate);
}

/**
 * Lê uma data de um CSV. Aceita `AAAA-MM-DD`, `AAAA/MM/DD` e, no formato português, `DD/MM/AAAA`,
 * `DD-MM-AAAA` e `DD.MM.AAAA`. Uma hora a seguir (`2025-01-05 13:44`, `2025-01-05T13:44Z`) é ignorada.
 */
export function parseDate(raw: string): Result<IsoDate, DateError> {
  const s = raw.trim();
  if (s === '') return err('empty');
  const datePart = s.split(/[T\s]/)[0] ?? '';
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(datePart);
  if (m) return makeIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(datePart);
  if (m) return makeIsoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return err('invalid_format');
}

export function isIsoDate(value: string): value is IsoDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDate(value).ok;
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7) as MonthKey;
}

export function makeMonthKey(year: number, month: number): MonthKey {
  return `${pad(year, 4)}-${pad(month)}` as MonthKey;
}

export function splitMonth(key: MonthKey): { year: number; month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, month } = splitMonth(key);
  const index = year * 12 + (month - 1) + n;
  return makeMonthKey(Math.floor(index / 12), (index % 12) + 1);
}

/** Todos os meses de `from` a `to`, inclusive (vazio se `from > to`). */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

/** Diferença em meses (`b − a`). */
export function monthsBetween(a: MonthKey, b: MonthKey): number {
  const x = splitMonth(a);
  const y = splitMonth(b);
  return (y.year - x.year) * 12 + (y.month - x.month);
}

function toUtcMs(date: IsoDate): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` as IsoDate;
}

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

/** Dias de `a` a `b` (`b − a`). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** Dia da semana ISO: 1 = segunda … 7 = domingo. */
export function isoWeekday(date: IsoDate): number {
  const d = new Date(toUtcMs(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Segunda-feira da semana de `date`. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function firstDayOfMonth(key: MonthKey): IsoDate {
  return `${key}-01` as IsoDate;
}

export function lastDayOfMonth(key: MonthKey): IsoDate {
  const { year, month } = splitMonth(key);
  return `${key}-${pad(daysInMonth(year, month))}` as IsoDate;
}

/** Converte um instante (por exemplo, `Date.now()` no servidor) na data de calendário em UTC. */
export function isoDateFromEpochMs(ms: number): IsoDate {
  return fromUtcMs(ms);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

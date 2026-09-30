import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareIsoDates,
  daysBetween,
  daysInMonth,
  firstDayOfMonth,
  isIsoDate,
  isoDateFromEpochMs,
  isoWeekday,
  lastDayOfMonth,
  makeIsoDate,
  makeMonthKey,
  monthOf,
  monthRange,
  monthsBetween,
  parseDate,
  startOfIsoWeek,
} from './dates';
import type { IsoDate, MonthKey } from './types';

const d = (s: string) => s as IsoDate;
const m = (s: string) => s as MonthKey;

describe('parseDate', () => {
  it.each([
    ['2025-01-05', '2025-01-05'],
    ['2025-1-5', '2025-01-05'],
    ['2025/01/05', '2025-01-05'],
    ['05/01/2025', '2025-01-05'],
    ['5-1-2025', '2025-01-05'],
    ['05.01.2025', '2025-01-05'],
    ['2025-01-05 13:44', '2025-01-05'],
    ['2025-01-05T23:59:00Z', '2025-01-05'],
    [' 2024-02-29 ', '2024-02-29'],
  ])('%s → %s', (raw, expected) => {
    expect(parseDate(raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'empty'],
    ['ontem', 'invalid_format'],
    ['2025-13-01', 'invalid_date'],
    ['2023-02-29', 'invalid_date'],
    ['31/04/2025', 'invalid_date'],
    ['1899-12-31', 'invalid_date'],
  ] as const)('%j → erro %s', (raw, error) => {
    expect(parseDate(raw)).toEqual({ ok: false, error });
  });
});

describe('calendário', () => {
  it('anos bissextos e dias por mês', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2025, 4)).toBe(30);
    expect(daysInMonth(2025, 13)).toBe(0);
  });

  it('makeIsoDate valida tipos e limites', () => {
    expect(makeIsoDate(2025, 1, 1.5).ok).toBe(false);
    expect(makeIsoDate(3000, 1, 1).ok).toBe(false);
    expect(makeIsoDate(2025, 0, 1).ok).toBe(false);
  });

  it('meses', () => {
    expect(monthOf(d('2025-10-31'))).toBe('2025-10');
    expect(addMonths(m('2025-11'), 3)).toBe('2026-02');
    expect(addMonths(m('2026-01'), -1)).toBe('2025-12');
    expect(monthRange(m('2025-11'), m('2026-02'))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange(m('2026-02'), m('2025-11'))).toEqual([]);
    expect(monthsBetween(m('2025-10'), m('2026-09'))).toBe(11);
    expect(makeMonthKey(2025, 3)).toBe('2025-03');
    expect(firstDayOfMonth(m('2024-02'))).toBe('2024-02-01');
    expect(lastDayOfMonth(m('2024-02'))).toBe('2024-02-29');
  });

  it('dias e semanas', () => {
    expect(addDays(d('2025-12-31'), 1)).toBe('2026-01-01');
    expect(addDays(d('2024-03-01'), -1)).toBe('2024-02-29');
    expect(daysBetween(d('2026-09-28'), d('2026-09-30'))).toBe(2);
    expect(isoWeekday(d('2025-10-01'))).toBe(3); // quarta-feira
    expect(isoWeekday(d('2026-09-27'))).toBe(7); // domingo
    expect(startOfIsoWeek(d('2025-10-01'))).toBe('2025-09-29');
    expect(isoDateFromEpochMs(Date.UTC(2026, 8, 30, 23, 30))).toBe('2026-09-30');
    expect(compareIsoDates(d('2025-01-01'), d('2025-01-02'))).toBe(-1);
    expect(compareIsoDates(d('2025-01-02'), d('2025-01-01'))).toBe(1);
    expect(compareIsoDates(d('2025-01-01'), d('2025-01-01'))).toBe(0);
    expect(isIsoDate('2025-02-30')).toBe(false);
    expect(isIsoDate('2025-02-28')).toBe(true);
  });

  it('addDays e daysBetween são inversos', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3000, max: 3000 }), (n) => {
        const base = d('2025-06-15');
        expect(daysBetween(base, addDays(base, n))).toBe(n);
      }),
    );
  });

  it('addMonths e monthsBetween são inversos', () => {
    fc.assert(
      fc.property(fc.integer({ min: -600, max: 600 }), (n) => {
        expect(monthsBetween(m('2025-06'), addMonths(m('2025-06'), n))).toBe(n);
      }),
    );
  });
});

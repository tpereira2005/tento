import type { HeatLevel } from '../types';
import { daysBetween, isoWeekday, monthOf, startOfIsoWeek } from '../dates';
import type { IsoDate, MonthKey } from '../types';

export type { HeatLevel } from '../types';
export interface HeatDay {
  date: IsoDate;
  level: HeatLevel;
}
export interface HeatCell {
  x: number;
  y: number;
  date: IsoDate;
  level: HeatLevel;
  column: number;
  row: number;
}

export interface CalendarGrid {
  cells: HeatCell[];
  columns: number;
  width: number;
  height: number;
  monthLabels: { x: number; month: MonthKey }[];
}

export interface CalendarOptions {
  cell: number;
  gap: number;
  weekStart: 'monday';
}

/**
 * Grelha de calendário: colunas = semanas ISO (segunda primeiro), linhas = dias da semana (0 = segunda).
 * A primeira semana parcial começa na linha certa; cada mês tem rótulo na coluna que contém o dia 1.
 */
export function calendarGrid(days: readonly HeatDay[], options: CalendarOptions): CalendarGrid {
  const { cell, gap } = options;
  const first = days.reduce<IsoDate | null>((min, d) => (min === null || d.date < min ? d.date : min), null);
  if (first === null) return { cells: [], columns: 0, width: 0, height: 0, monthLabels: [] };

  const origin = startOfIsoWeek(first);
  const step = cell + gap;
  const cells = days.map((d): HeatCell => {
    const column = Math.floor(daysBetween(origin, d.date) / 7);
    const row = isoWeekday(d.date) - 1;
    return { x: column * step, y: row * step, date: d.date, level: d.level, column, row };
  });

  const columns = cells.reduce((max, c) => Math.max(max, c.column + 1), 0);
  const monthLabels = cells
    .filter((c) => c.date.endsWith('-01'))
    .sort((a, b) => a.column - b.column)
    .map((c) => ({ x: c.x, month: monthOf(c.date) }));

  return { cells, columns, width: columns * step - gap, height: 7 * step - gap, monthLabels };
}

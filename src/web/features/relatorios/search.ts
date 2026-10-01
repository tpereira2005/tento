import { z } from 'zod';
import { isIsoDate, type IsoDate } from '../../../core';
import {
  ALL_BOOKMAKERS,
  ALL_PROFILES,
  PERIODS,
  periodRange,
  type DashboardFilters,
  type Period,
} from '../painel/search';

/** O período por omissão dos relatórios é o histórico completo. */
export const DEFAULT_REPORT_PERIOD: Period = 'tudo';

const idParam = z.string().min(1).max(64).optional().catch(undefined);
const dateParam = z
  .string()
  .refine((s): boolean => isIsoDate(s))
  .optional()
  .catch(undefined);

/**
 * Âmbito do relatório no URL: `?perfil=…&casa=…&periodo=3m|6m|12m|tudo&de=AAAA-MM-DD&ate=AAAA-MM-DD`.
 * `de`/`ate` têm prioridade sobre `periodo`. Valores inválidos são ignorados.
 */
export const reportSearch = z.object({
  perfil: idParam,
  casa: idParam,
  periodo: z.enum(PERIODS).optional().catch(undefined),
  de: dateParam,
  ate: dateParam,
});

export type ReportSearch = z.infer<typeof reportSearch>;

export function parseReportSearch(raw: Record<string, unknown>): ReportSearch {
  return reportSearch.parse(raw);
}

/** Âmbito efetivo: o `period` é `custom` quando há datas explícitas. */
export interface ReportFilters extends Omit<DashboardFilters, 'period'> {
  period: Period | 'custom';
}

export function hasCustomRange(search: ReportSearch): boolean {
  return search.de !== undefined || search.ate !== undefined;
}

export function resolveReportFilters(search: ReportSearch, today: IsoDate): ReportFilters {
  const custom = hasCustomRange(search);
  const period: Period = search.periodo ?? DEFAULT_REPORT_PERIOD;
  const range = custom
    ? { from: search.de as IsoDate | undefined, to: search.ate as IsoDate | undefined }
    : periodRange(period, today);
  const out: ReportFilters = { period: custom ? 'custom' : period };
  if (search.perfil && search.perfil !== ALL_PROFILES) out.profileId = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.bookmakerId = search.casa;
  if (range.from) out.from = range.from;
  if (range.to) out.to = range.to;
  return out;
}

/** Procura no URL sem os valores por omissão. */
export function cleanReportSearch(search: ReportSearch): ReportSearch {
  const out: ReportSearch = {};
  if (search.perfil && search.perfil !== ALL_PROFILES) out.perfil = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.casa = search.casa;
  if (hasCustomRange(search)) {
    if (search.de) out.de = search.de;
    if (search.ate) out.ate = search.ate;
  } else if (search.periodo && search.periodo !== DEFAULT_REPORT_PERIOD) {
    out.periodo = search.periodo;
  }
  return out;
}

/** Parâmetros de filtro da API (`/stats/dashboard`, `/transactions`). */
export function reportQueryParams(f: ReportFilters): Record<string, string | undefined> {
  return { profileIds: f.profileId, bookmakerIds: f.bookmakerId, from: f.from, to: f.to };
}

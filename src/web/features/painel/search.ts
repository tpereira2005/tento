import { z } from 'zod';
import { addMonths, firstDayOfMonth, isoDateFromEpochMs, monthOf, type IsoDate } from '../../../core';

export const PERIODS = ['3m', '6m', '12m', 'tudo'] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = '12m';
export const ALL_PROFILES = 'todos';
export const ALL_BOOKMAKERS = 'todas';

/** Filtros do painel no URL: `?perfil=…&casa=…&periodo=3m|6m|12m|tudo`. Valores inválidos são ignorados. */
export const dashboardSearch = z.object({
  perfil: z.string().min(1).max(64).optional().catch(undefined),
  casa: z.string().min(1).max(64).optional().catch(undefined),
  periodo: z.enum(PERIODS).optional().catch(undefined),
});

export type DashboardSearch = z.infer<typeof dashboardSearch>;

/** Para `validateSearch` do router. */
export function parseDashboardSearch(raw: Record<string, unknown>): DashboardSearch {
  return dashboardSearch.parse(raw);
}

export interface DashboardFilters {
  profileId?: string;
  bookmakerId?: string;
  period: Period;
  from?: IsoDate;
  to?: IsoDate;
}

const MONTHS_OF: Record<Exclude<Period, 'tudo'>, number> = { '3m': 3, '6m': 6, '12m': 12 };

/** Intervalo de datas de um período: do 1.º dia do mês de há N−1 meses até hoje; `tudo` não tem limites. */
export function periodRange(period: Period, today: IsoDate): { from?: IsoDate; to?: IsoDate } {
  if (period === 'tudo') return {};
  return { from: firstDayOfMonth(addMonths(monthOf(today), 1 - MONTHS_OF[period])), to: today };
}

export function todayIso(): IsoDate {
  return isoDateFromEpochMs(Date.now());
}

export function resolveFilters(search: DashboardSearch, today: IsoDate): DashboardFilters {
  const period = search.periodo ?? DEFAULT_PERIOD;
  const out: DashboardFilters = { period, ...periodRange(period, today) };
  if (search.perfil && search.perfil !== ALL_PROFILES) out.profileId = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.bookmakerId = search.casa;
  return out;
}

/** Procura no URL sem os valores por omissão, para o endereço ficar limpo. */
export function cleanSearch(search: DashboardSearch): DashboardSearch {
  const out: DashboardSearch = {};
  if (search.perfil && search.perfil !== ALL_PROFILES) out.perfil = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.casa = search.casa;
  if (search.periodo && search.periodo !== DEFAULT_PERIOD) out.periodo = search.periodo;
  return out;
}

/** Parâmetros de filtro da API (`/stats/dashboard`, `/transactions`). */
export function filterQueryParams(f: DashboardFilters): Record<string, string | undefined> {
  return { profileIds: f.profileId, bookmakerIds: f.bookmakerId, from: f.from, to: f.to };
}

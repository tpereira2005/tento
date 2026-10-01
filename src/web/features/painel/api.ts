import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BreakdownRow, DayCell, Insight, MonthlyPoint, Streaks, Summary } from '../../../core';
import { api } from '../../api/client';
import type { TxnDto } from '../../api/types';
import { filterQueryParams, type DashboardFilters } from './search';

/** Resposta de `GET /api/stats/dashboard` (só números; sem nomes). */
export interface DashboardDto {
  summary: Summary;
  monthly: MonthlyPoint[];
  streaks: Streaks;
  heatmap: DayCell[];
  breakdown: { wallet: BreakdownRow[]; profile: BreakdownRow[]; bookmaker: BreakdownRow[] };
  insights: Insight[];
}

export interface RecentDto {
  items: TxnDto[];
}

export const RECENT_LIMIT = 5;

/** `['stats', …]`: as importações (e o desfazer) invalidam esta raiz. */
export const painelKeys = {
  dashboard: (f: DashboardFilters) => ['stats', 'dashboard', f] as const,
  recent: (f: DashboardFilters) => ['stats', 'recent', f] as const,
};

export function useDashboard(filters: DashboardFilters, enabled: boolean) {
  return useQuery({
    queryKey: painelKeys.dashboard(filters),
    queryFn: () => api<DashboardDto>('/stats/dashboard', { query: filterQueryParams(filters) }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecentTransactions(filters: DashboardFilters, enabled: boolean) {
  return useQuery({
    queryKey: painelKeys.recent(filters),
    queryFn: () =>
      api<RecentDto>('/transactions', { query: { ...filterQueryParams(filters), limit: RECENT_LIMIT } }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

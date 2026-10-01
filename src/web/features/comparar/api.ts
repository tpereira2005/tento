import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { DashboardDto } from '../painel/api';
import type { SideParams } from './search';

/** `['stats', 'compare', …]`: as importações (e o desfazer) invalidam a raiz `stats`. */
export const compareKeys = {
  side: (params: SideParams) => ['stats', 'compare', params] as const,
};

/** Uma consulta por lado: os mesmos números do painel para o perfil, a casa ou o período desse lado. */
export function useCompareSide(params: SideParams, enabled: boolean) {
  return useQuery({
    queryKey: compareKeys.side(params),
    queryFn: () => api<DashboardDto>('/stats/dashboard', { query: { ...params } }),
    enabled,
  });
}

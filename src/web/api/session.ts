import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { api, isApiError } from './client';
import type { MeDto, SetupDto } from './types';

/** Sessão atual (utilizador e definições). Responde 401 quando não há sessão. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => api<MeDto>('/me'),
});

/** Estado do registo: só está aberto enquanto não existir nenhum utilizador. */
export const setupQuery = queryOptions({
  queryKey: ['setup'],
  queryFn: () => api<SetupDto>('/setup'),
  staleTime: 0,
});

/** A sessão, ou `null` se não houver (qualquer outro erro continua a ser lançado). */
export async function getSessionOrNull(queryClient: QueryClient): Promise<MeDto | null> {
  try {
    return await queryClient.query(meQuery);
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

/** Esquece a sessão em cache (depois de entrar ou sair). */
export function forgetSession(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: meQuery.queryKey });
}

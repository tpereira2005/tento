import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../api/client';
import type { TxnDto } from '../../api/types';
import type { DashboardDto } from '../painel/api';
import { listParams, statsParams, type TxnFilters } from './search';

export const PAGE_SIZE = 50;

export interface TxnPageDto {
  items: TxnDto[];
  nextCursor: string | null;
  total: number;
}

/** Raízes invalidadas depois de qualquer escrita: lista, estatísticas (Painel) e contas (contagens). */
const ROOTS = [['transactions'], ['stats'], ['wallets']] as const;

export const txnKeys = {
  list: (f: TxnFilters) => ['transactions', 'list', f] as const,
  sums: (f: TxnFilters) => ['stats', 'transactions-sums', statsParams(f)] as const,
};

/** Páginas por cursor (keyset): `fetchNextPage` junta a seguinte; `nextCursor === null` termina. */
export function useTransactionPages(filters: TxnFilters) {
  return useInfiniteQuery({
    queryKey: txnKeys.list(filters),
    queryFn: ({ pageParam }) =>
      api<TxnPageDto>('/transactions', {
        query: { ...listParams(filters), limit: PAGE_SIZE, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** Somas do filtro vindas do mesmo endpoint do Painel, para os números coincidirem. */
export function useTransactionSums(filters: TxnFilters) {
  return useQuery({
    queryKey: txnKeys.sums(filters),
    queryFn: () => api<DashboardDto>('/stats/dashboard', { query: statsParams(filters) }),
    placeholderData: keepPreviousData,
    select: (d) => d.summary,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all(ROOTS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export interface NewTxn {
  walletId: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  amountCents: number;
  note?: string;
}

export interface TxnPatch {
  date?: string;
  type?: 'deposit' | 'withdrawal';
  amountCents?: number;
  note?: string | null;
}

export function useCreateTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: NewTxn) => api<TxnDto>('/transactions', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { id: string; patch: TxnPatch }) =>
      api<TxnDto>(`/transactions/${encodeURIComponent(v.id)}`, { method: 'PATCH', body: v.patch }),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      api<undefined>(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

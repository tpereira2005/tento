import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { ImportBatchDto, ListDto } from '../../../api/types';

export const importKeys = {
  imports: ['imports'] as const,
  wallets: ['wallets'] as const,
  stats: ['stats'] as const,
};

export const useImports = () =>
  useQuery({
    queryKey: importKeys.imports,
    queryFn: () => api<ListDto<ImportBatchDto>>('/imports'),
  });

/** Desfazer apaga transações: o histórico, as contas (contagens) e as estatísticas desatualizam-se. */
export function useUndoImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ImportBatchDto>(`/imports/${encodeURIComponent(id)}/undo`, { method: 'POST' }),
    onSettled: () =>
      Promise.all(
        [importKeys.imports, importKeys.wallets, importKeys.stats].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

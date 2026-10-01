import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CsvFatalError, CsvMeta, ParsedRow, RowIssue, TxnType } from '../../../../core';
import { api } from '../../../api/client';
import type { ImportBatchDto } from '../../../api/types';
import { keys as settingsKeys } from '../../definicoes/api';

/** Resposta de `POST /api/imports/preview` (datas chegam como texto `AAAA-MM-DD`). */
export interface PreviewDto {
  meta: CsvMeta;
  counts: {
    total: number;
    valid: number;
    invalid: number;
    toAdd: number;
    duplicates: number;
    conflicts: number;
    missingFromFile: number;
  };
  issues: RowIssue[];
  issuesTotal: number;
  conflicts: {
    incoming: ParsedRow;
    existing: { date: string; type: TxnType; amountCents: number };
  }[];
  toAddSample: ParsedRow[];
}

export interface ImportRequest {
  walletId: string;
  filename: string;
  csv: string;
}

/** Chaves das consultas deste ecrã. O histórico (outro componente) usa `['imports']`. */
export const importKeys = {
  history: ['imports'] as const,
  stats: ['stats'] as const,
  preview: (walletId: string, fileId: number) => ['import-preview', walletId, fileId] as const,
};

/**
 * Pré-visualização do ficheiro escolhido. `fileId` identifica a escolha (não o texto, que pode ter megabytes);
 * nada é guardado em cache depois de o ecrã sair.
 */
export function usePreview(request: (ImportRequest & { fileId: number }) | null) {
  return useQuery({
    queryKey: importKeys.preview(request?.walletId ?? '', request?.fileId ?? 0),
    queryFn: ({ signal }) => {
      if (!request) throw new Error('sem pedido');
      const body: ImportRequest = {
        walletId: request.walletId,
        filename: request.filename,
        csv: request.csv,
      };
      return api<PreviewDto>('/imports/preview', { method: 'POST', body, signal });
    },
    enabled: request !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/** Grava a importação e desatualiza tudo o que depende dos movimentos da conta. */
export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => api<ImportBatchDto>('/imports', { method: 'POST', body }),
    onSuccess: () =>
      Promise.all(
        [settingsKeys.wallets, importKeys.history, importKeys.stats].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/** Erro fatal de leitura enviado pelo servidor (422), ou `null` se o erro for de outro tipo. */
export function fatalOf(details: unknown): CsvFatalError | null {
  if (typeof details !== 'object' || details === null || !('code' in details)) return null;
  const code = details.code;
  if (code === 'empty' || code === 'no_header' || code === 'too_many_rows') return { code };
  if (code === 'missing_columns') {
    const missing = (details as { missing?: unknown }).missing;
    const valid = Array.isArray(missing)
      ? missing.filter((m): m is 'date' | 'type' | 'amount' => m === 'date' || m === 'type' || m === 'amount')
      : [];
    return { code, missing: valid };
  }
  return null;
}

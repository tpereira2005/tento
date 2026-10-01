import { useCallback, useRef, useState } from 'react';
import { collectReportInput, reportFilename } from './buildInput';
import type { ReportFilters } from './search';

export type ReportPhase = 'idle' | 'collecting' | 'drawing' | 'done' | 'error';

export interface ReportState {
  phase: ReportPhase;
  /** Transações recolhidas até agora. */
  loaded: number;
  /** Nome do ficheiro gerado (fase `done`). */
  filename: string;
}

export interface ReportGenerator extends ReportState {
  running: boolean;
  /** Filtros da última execução, para repetir depois de um erro. */
  run: (filters: ReportFilters) => Promise<void>;
  retry: () => void;
}

const REVOKE_DELAY_MS = 1000;

/** Descarrega o ficheiro por um URL de objeto, que é revogado logo a seguir. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}

const IDLE: ReportState = { phase: 'idle', loaded: 0, filename: '' };

/**
 * Recolhe os dados, desenha o PDF (módulo carregado só aqui) e descarrega-o.
 * Uma execução de cada vez; os erros ficam no estado para a interface oferecer "Tentar novamente".
 */
export function useReportGenerator(): ReportGenerator {
  const [state, setState] = useState<ReportState>(IDLE);
  const busy = useRef(false);
  const last = useRef<ReportFilters | null>(null);

  const run = useCallback(async (filters: ReportFilters) => {
    if (busy.current) return;
    busy.current = true;
    last.current = filters;
    setState({ phase: 'collecting', loaded: 0, filename: '' });
    try {
      const input = await collectReportInput(filters, {
        onProgress: (loaded) => {
          setState((s) => ({ ...s, phase: 'collecting', loaded }));
        },
      });
      setState((s) => ({ ...s, phase: 'drawing' }));
      const { buildReportPdf } = await import('../../pdf');
      const blob = await buildReportPdf(input);
      const filename = reportFilename(input.generatedOn);
      downloadBlob(blob, filename);
      setState((s) => ({ ...s, phase: 'done', filename }));
    } catch {
      setState((s) => ({ ...s, phase: 'error' }));
    } finally {
      busy.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current);
  }, [run]);

  return {
    ...state,
    running: state.phase === 'collecting' || state.phase === 'drawing',
    run,
    retry,
  };
}

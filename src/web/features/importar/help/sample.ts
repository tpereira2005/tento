/** Nome do ficheiro descarregado. */
export const SAMPLE_FILENAME = 'exemplo-tento.csv';

const BOM = '﻿';
const CRLF = '\r\n';

/** Cabeçalho canónico do formato (com a grafia original `Tipe` e `Vaule`, que o Tento aceita). */
export const SAMPLE_HEADER = 'Date;Tipe;Vaule';

/** Linhas inventadas, com formatos de valor misturados (`20`, `20,00`, `35,50`). */
const SAMPLE_ROWS: readonly string[] = [
  '2025-01-05;Deposit;20',
  '2025-01-12;Deposit;50,00',
  '2025-01-27;Withdrawal;35,50',
  '2025-02-03;Deposit;20,00',
  '2025-02-18;Withdrawal;60',
  '2025-03-09;Deposit;15,75',
];

/** O CSV de exemplo tal como é descarregado: BOM, cabeçalho e linhas separadas por CRLF. */
export function buildSampleCsv(): string {
  return `${BOM}${[SAMPLE_HEADER, ...SAMPLE_ROWS].join(CRLF)}${CRLF}`;
}

/** O mesmo conteúdo para mostrar no ecrã (sem BOM, com quebras de linha normais). */
export function sampleCsvPreview(): string {
  return [SAMPLE_HEADER, ...SAMPLE_ROWS].join('\n');
}

/** Descarrega o exemplo no browser, sem pedidos à rede (Blob + ligação temporária). */
export function downloadSampleCsv(): void {
  const blob = new Blob([buildSampleCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = SAMPLE_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // revogar logo a seguir pode cancelar o descarregamento nalguns browsers
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

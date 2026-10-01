import type { ReportInput } from './types';

export type {
  ReportInput,
  ReportLabels,
  ReportMonthly,
  ReportRow,
  ReportSummary,
  ReportTransaction,
} from './types';
export { enReportLabels, ptReportLabels } from './labels';

/**
 * Gera o PDF do relatório no browser. O react-pdf, as fontes e o documento só são carregados aqui,
 * por importação dinâmica: nada disto entra no pacote principal.
 */
export async function buildReportPdf(input: ReportInput): Promise<Blob> {
  const [{ pdf }, { ReportDocument }, { registerPdfFonts }, { fontUrls }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ReportDocument'),
    import('./fonts'),
    import('./font-urls'),
  ]);
  await registerPdfFonts(fontUrls);
  return pdf(ReportDocument({ input })).toBlob();
}

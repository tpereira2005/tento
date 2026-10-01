import { Document } from '@react-pdf/renderer';
import { BreakdownPage } from './BreakdownPage';
import { CoverPage } from './CoverPage';
import { EvolutionPage } from './EvolutionPage';
import { fill } from './format';
import { TransactionsPages } from './TransactionsPages';
import type { ReportInput } from './types';

/** O relatório: capa e resumo, evolução, repartições e destaques, transações (várias páginas). */
export function ReportDocument({ input }: { input: ReportInput }) {
  return (
    <Document
      title={fill(input.labels.documentTitle, { title: input.title })}
      author="Tento"
      creator="Tento"
      producer="Tento"
    >
      <CoverPage input={input} />
      <EvolutionPage input={input} />
      <BreakdownPage input={input} />
      <TransactionsPages input={input} />
    </Document>
  );
}

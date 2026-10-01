import { createFileRoute } from '@tanstack/react-router';
import { RelatoriosPage } from '../../features/relatorios/RelatoriosPage';
import { parseReportSearch } from '../../features/relatorios/search';

export const Route = createFileRoute('/_app/relatorios')({
  validateSearch: parseReportSearch,
  component: RelatoriosPage,
});

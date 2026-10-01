import { createFileRoute } from '@tanstack/react-router';
import { PainelPage } from '../../features/painel/PainelPage';
import { parseDashboardSearch } from '../../features/painel/search';

export const Route = createFileRoute('/_app/')({
  validateSearch: parseDashboardSearch,
  component: PainelPage,
});

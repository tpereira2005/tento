import { createFileRoute } from '@tanstack/react-router';
import { ImportPage } from '../../features/importar/ImportPage';

export const Route = createFileRoute('/_app/importar')({
  validateSearch: (search: Record<string, unknown>): { conta?: string } =>
    typeof search.conta === 'string' && search.conta !== '' ? { conta: search.conta } : {},
  component: ImportRoute,
});

function ImportRoute() {
  const { conta } = Route.useSearch();
  return <ImportPage walletId={conta} />;
}

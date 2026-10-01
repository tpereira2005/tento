import { createFileRoute } from '@tanstack/react-router';
import { parseTransactionsSearch } from '../../features/transacoes/search';
import { TransacoesPage } from '../../features/transacoes/TransacoesPage';

export const Route = createFileRoute('/_app/transacoes')({
  validateSearch: parseTransactionsSearch,
  component: TransacoesPage,
});

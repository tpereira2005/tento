import { createFileRoute } from '@tanstack/react-router';
import { ComparePage } from '../../features/comparar/ComparePage';
import { parseCompareSearch } from '../../features/comparar/search';

export const Route = createFileRoute('/_app/comparar')({
  validateSearch: parseCompareSearch,
  component: ComparePage,
});

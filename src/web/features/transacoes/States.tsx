import { Link } from '@tanstack/react-router';
import { Plus, SearchX, Sprout, TriangleAlert, Upload } from 'lucide-react';
import { t } from '../../i18n';
import { Button, Card, Skeleton } from '../../ui';
import { LINK_PRIMARY, LINK_SECONDARY } from '../painel/States';

export function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t().transactions.loading}</span>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

export function ListError({ onRetry }: { onRetry: () => void }) {
  const m = t().transactions;
  return (
    <Card role="alert" className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-neg-tint text-neg-text">
          <TriangleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p>{m.loadError}</p>
        <Button variant="secondary" onClick={onRetry}>
          {m.retry}
        </Button>
      </div>
    </Card>
  );
}

/** Ainda não há nenhuma transação: caminhos para importar ou adicionar à mão. */
export function NoTransactions({ onAdd }: { onAdd: () => void }) {
  const m = t().transactions;
  return (
    <Card aria-labelledby="sem-transacoes-titulo">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-pos-tint text-pos">
          <Sprout size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h2 id="sem-transacoes-titulo" className="font-display text-[24px] leading-tight font-normal">
          {m.empty.title}
        </h2>
        <p className="text-ink-2">{m.empty.body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/importar" className={LINK_PRIMARY}>
            <Upload size={16} strokeWidth={1.8} aria-hidden="true" />
            {m.importCsv}
          </Link>
          <button type="button" className={LINK_SECONDARY} onClick={onAdd}>
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            {m.add}
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Há transações, mas nenhuma cumpre os filtros. */
export function NoResults({ onClear }: { onClear: () => void }) {
  const m = t().transactions;
  return (
    <Card>
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
          <SearchX size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="font-display text-[22px] font-normal">{m.noResults.title}</p>
        <p className="text-ink-2">{m.noResults.hint}</p>
        <Button variant="secondary" className="mt-2" onClick={onClear}>
          {m.filters.clear}
        </Button>
      </div>
    </Card>
  );
}

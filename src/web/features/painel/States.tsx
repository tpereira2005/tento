import { Link } from '@tanstack/react-router';
import { CalendarX2, Sprout, TriangleAlert } from 'lucide-react';
import { t } from '../../i18n';
import { Button, Card, Skeleton } from '../../ui';

const LINK_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-cta px-4 text-[14px] font-semibold whitespace-nowrap text-cta-ink hover:brightness-110';
const LINK_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-control px-4 text-[14px] font-medium whitespace-nowrap text-ink hover:bg-surface-2';

/** Blocos reservados com a forma do painel, para não saltar quando os dados chegam. */
export function PainelSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t().dashboard.loading}</span>
      <Skeleton className="h-[420px] md:h-[300px]" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        <Skeleton className="h-[360px] md:col-span-2 lg:col-span-8" />
        <Skeleton className="h-[360px] md:col-span-2 lg:col-span-4" />
        <Skeleton className="h-[260px] md:col-span-2 lg:col-span-8" />
        <Skeleton className="h-[260px] lg:col-span-4" />
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  );
}

export function PainelError({ onRetry }: { onRetry: () => void }) {
  const d = t().dashboard;
  return (
    <Card role="alert" className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-neg-tint text-neg-text">
          <TriangleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p>{d.loadError}</p>
        <Button variant="secondary" onClick={onRetry}>
          {d.retry}
        </Button>
      </div>
    </Card>
  );
}

/** Filtros sem movimentos: calmo, sem alarme. */
export function NoMovements() {
  const d = t().dashboard;
  return (
    <Card>
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
          <CalendarX2 size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="font-display text-[22px] font-normal">{d.noData}</p>
        <p className="text-ink-2">{d.noDataHint}</p>
      </div>
    </Card>
  );
}

/** Primeiros passos, quando ainda não há nenhuma transação. */
export function Welcome() {
  const w = t().dashboard.welcome;
  return (
    <Card aria-labelledby="boas-vindas-titulo">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-pos-tint text-pos">
          <Sprout size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h2 id="boas-vindas-titulo" className="font-display text-[26px] leading-tight font-normal">
          {w.title}
        </h2>
        <p className="text-ink-2">{w.body}</p>
        <ol className="flex w-full list-decimal flex-col gap-2 pl-6 text-left">
          <li>{w.step1}</li>
          <li>{w.step2}</li>
        </ol>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/definicoes" className={LINK_SECONDARY}>
            {w.toSettings}
          </Link>
          <Link to="/importar" className={LINK_PRIMARY}>
            {w.toImport}
          </Link>
        </div>
      </div>
    </Card>
  );
}

export { LINK_PRIMARY, LINK_SECONDARY };

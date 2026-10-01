import { Hourglass } from 'lucide-react';
import { t } from '../../i18n';
import { Card, Chip } from '../../ui';
import { usePageTitle } from './usePageTitle';

type PlaceholderKey = 'dashboard' | 'transactions' | 'import' | 'compare' | 'reports';

/** Página que ainda não existe: título real, e um estado vazio que diz em que etapa chega. */
export function StagePlaceholder({ page }: { page: PlaceholderKey }) {
  const p = t().placeholders;
  const m = p[page];
  usePageTitle(m.title);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[44px] leading-none font-light tracking-[-0.02em] sm:text-[56px]">
          {m.title}
        </h1>
        <p className="mt-3 text-ink-2">{m.lead}</p>
      </header>
      <Card aria-labelledby="vazio-titulo">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-pos-tint text-pos">
            <Hourglass size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <Chip>{p.stage.replace('{n}', m.stage)}</Chip>
          <h2 id="vazio-titulo" className="font-display text-[22px] leading-tight font-normal">
            {m.emptyTitle}
          </h2>
          <p className="font-medium">{m.emptyBody}</p>
          <p className="text-ink-2">{m.emptyHint}</p>
        </div>
      </Card>
    </div>
  );
}

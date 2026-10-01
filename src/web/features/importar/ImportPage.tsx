import { useRef } from 'react';
import { t } from '../../i18n';
import { usePageTitle } from '../shell/usePageTitle';
import { FormatHelp } from './help';
import { ImportHistory } from './history';
import { ImportWizard } from './wizard/ImportWizard';

/** Move a vista e o foco para um bloco da página (respeita `prefers-reduced-motion`). */
function reveal(el: HTMLElement | null) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

/** Abre a ajuda do formato (que reage ao fragmento `#formato`), foca-a e leva-a à vista. */
function showFormat() {
  window.history.replaceState(window.history.state as unknown, '', '#formato');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById('formato')
    ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** Página Importar: assistente, histórico das importações e ajuda sobre o formato. */
export function ImportPage({ walletId }: { walletId?: string | undefined }) {
  const m = t().import;
  usePageTitle(m.title);
  const history = useRef<HTMLDivElement>(null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl font-light tracking-[-0.02em]">{m.title}</h1>
        <p className="mt-2 text-ink-2">{m.intro}</p>
      </header>
      <ImportWizard
        initialWalletId={walletId}
        onViewHistory={() => {
          reveal(history.current);
        }}
        onShowFormat={showFormat}
      />
      <div id="importar-historico" ref={history} tabIndex={-1}>
        <ImportHistory />
      </div>
      <FormatHelp />
    </div>
  );
}

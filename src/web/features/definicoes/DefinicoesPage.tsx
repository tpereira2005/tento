import { useCallback, useState } from 'react';
import { t } from '../../i18n';
import { AccountSection } from './AccountSection';
import { NamedListSection } from './NamedListSection';
import { WalletsSection } from './WalletsSection';

const NBSP = String.fromCharCode(0xa0);

/** Página de definições: casas, perfis, contas e conta do utilizador. */
export function DefinicoesPage() {
  const s = t().settings;
  const [notice, setNotice] = useState('');
  // alternar um espaço final faz o leitor de ecrã repetir avisos iguais
  const announce = useCallback((message: string) => {
    setNotice((prev) => (prev === message ? `${message}${NBSP}` : message));
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="font-display text-4xl font-light tracking-[-0.02em]">{s.title}</h1>
        <p className="mt-2 text-ink-2">{s.intro}</p>
      </header>
      <NamedListSection kind="bookmakers" announce={announce} />
      <NamedListSection kind="profiles" announce={announce} />
      <WalletsSection announce={announce} />
      <AccountSection announce={announce} />
      <div role="status" aria-live="polite" aria-label={s.announcements} className="sr-only">
        {notice}
      </div>
    </div>
  );
}

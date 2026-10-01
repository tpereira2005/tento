import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { Logo, ThemeToggle } from '../../ui';
import { usePageTitle } from '../shell/usePageTitle';

interface AuthLayoutProps {
  title: string;
  intro?: string;
  children: ReactNode;
}

/** Página pública de entrada: marca, título em Fraunces e um cartão calmo com o formulário. */
export function AuthLayout({ title, intro, children }: AuthLayoutProps) {
  usePageTitle(title);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between px-4 sm:px-10">
        <Link to="/" aria-label={t().shell.homeLink}>
          <Logo size="md" />
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-[440px] flex-1 px-4 py-8 outline-none sm:py-14"
      >
        <h1 className="font-display text-[44px] leading-none font-light tracking-[-0.02em] sm:text-[52px]">
          {title}
        </h1>
        {intro ? <p className="mt-3 text-ink-2">{intro}</p> : null}
        <div className="mt-8 rounded-[14px] border border-line bg-surface p-5 sm:p-6">{children}</div>
      </main>
    </div>
  );
}

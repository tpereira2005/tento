import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { t } from '../i18n';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar para o conteúdo
      </a>
      <header className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-10">
        <Link to="/" aria-label={`${t().app.name} — início`}>
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="conteudo" className="px-4 py-8 sm:px-10">
        <Outlet />
      </main>
    </>
  );
}

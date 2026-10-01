import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { api } from '../../api/client';
import { meQuery } from '../../api/session';
import type { MeDto } from '../../api/types';
import { t } from '../../i18n';
import { applyPreference, type Theme } from '../../theme';
import { Logo, ThemeToggle } from '../../ui';
import { BottomTabs } from './BottomTabs';
import { DesktopNav } from './DesktopNav';
import { UserMenu } from './UserMenu';

/** Estrutura das páginas com sessão: barra superior, conteúdo e separadores em baixo no móvel. */
export function AppShell() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const savedTheme = me?.settings.theme;

  // Num navegador sem escolha local (primeiro acesso, outro dispositivo) segue o tema guardado na conta.
  useEffect(() => {
    if (savedTheme) applyPreference(savedTheme, { onlyIfUnset: true });
  }, [savedTheme]);

  const saveTheme = useMutation({
    mutationFn: (theme: Theme) =>
      api<MeDto['settings']>('/me/settings', { method: 'PATCH', body: { theme } }),
    onSuccess: (settings) => {
      queryClient.setQueryData<MeDto>(meQuery.queryKey, (old) => (old ? { ...old, settings } : old));
    },
  });

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto grid h-16 max-w-[1360px] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-10 md:grid-cols-[1fr_auto_1fr]">
          <Link to="/" aria-label={t().shell.homeLink} className="justify-self-start">
            <Logo size="md" />
          </Link>
          <DesktopNav />
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle
              onChange={(theme) => {
                saveTheme.mutate(theme);
              }}
            />
            {me ? <UserMenu name={me.user.name} email={me.user.email} /> : null}
          </div>
        </div>
      </header>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto max-w-[1360px] px-4 pt-8 pb-28 outline-none sm:px-10 md:pb-12"
      >
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
}

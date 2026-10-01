import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSessionOrNull } from '../api/session';
import { AppShell } from '../features/shell/AppShell';
import { InlineNotFound, RouteError } from '../features/shell/ErrorPages';

/** Layout das páginas com sessão: sem sessão, vai para a entrada e volta depois ao sítio pedido. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await getSessionOrNull(context.queryClient);
    if (!me) throw redirect({ to: '/entrar', search: { redirect: location.href } });
  },
  component: AppShell,
  notFoundComponent: InlineNotFound,
  errorComponent: RouteError,
});

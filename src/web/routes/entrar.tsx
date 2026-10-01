import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSessionOrNull } from '../api/session';
import { AuthLayout } from '../features/auth/AuthLayout';
import { safeRedirect } from '../features/auth/redirect';
import { SignInForm } from '../features/auth/SignInForm';
import { useFinishAuth } from '../features/auth/useFinishAuth';
import { RouteError } from '../features/shell/ErrorPages';
import { t } from '../i18n';

export const Route = createFileRoute('/entrar')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context }) => {
    if (await getSessionOrNull(context.queryClient)) throw redirect({ to: '/' });
  },
  component: SignInPage,
  errorComponent: RouteError,
});

function SignInPage() {
  const search = Route.useSearch();
  const finish = useFinishAuth();
  const m = t().auth.signIn;
  return (
    <AuthLayout title={m.title} intro={m.intro}>
      <SignInForm onSignedIn={() => finish(safeRedirect(search.redirect))} />
    </AuthLayout>
  );
}

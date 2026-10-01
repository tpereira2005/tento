import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSessionOrNull } from '../api/session';
import { RegistrationGate } from '../features/auth/RegistrationGate';
import { useFinishAuth } from '../features/auth/useFinishAuth';
import { RouteError } from '../features/shell/ErrorPages';

export const Route = createFileRoute('/registar')({
  beforeLoad: async ({ context }) => {
    if (await getSessionOrNull(context.queryClient)) throw redirect({ to: '/' });
  },
  component: SignUpPage,
  errorComponent: RouteError,
});

function SignUpPage() {
  const finish = useFinishAuth();
  return <RegistrationGate onSignedUp={() => finish('/')} />;
}

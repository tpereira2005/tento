import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { setupQuery } from '../../api/session';
import { t } from '../../i18n';
import { Button, Skeleton } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { SignUpForm } from './SignUpForm';

interface RegistrationGateProps {
  onSignedUp: () => Promise<void> | void;
}

/** Página de registo: só mostra o formulário se a API disser que o registo está aberto. */
export function RegistrationGate({ onSignedUp }: RegistrationGateProps) {
  const m = t().auth.signUp;
  const setup = useQuery(setupQuery);
  const [closedByApi, setClosedByApi] = useState(false);

  if (closedByApi || (setup.isSuccess && !setup.data.registrationOpen)) {
    return (
      <AuthLayout title={m.closedTitle}>
        <div className="flex flex-col items-start gap-4">
          <p className="font-display text-[22px] leading-snug">{m.closedBody}</p>
          <Link
            to="/entrar"
            className="inline-flex h-10 items-center rounded-[10px] bg-cta px-4 text-[14px] font-semibold text-cta-ink hover:brightness-110"
          >
            {m.closedAction}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={m.title} intro={m.intro}>
      {setup.isPending ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{m.checking}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : setup.isError ? (
        <div className="flex flex-col items-start gap-4">
          <p role="alert" className="font-medium text-neg-text">
            {m.checkFailed}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              void setup.refetch();
            }}
          >
            {t().errors.retry}
          </Button>
        </div>
      ) : (
        <SignUpForm
          onSignedUp={onSignedUp}
          onClosed={() => {
            setClosedByApi(true);
          }}
        />
      )}
    </AuthLayout>
  );
}

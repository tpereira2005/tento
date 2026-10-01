import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { authClient } from '../../api/auth';
import { t } from '../../i18n';
import { Button, PasswordField, TextField } from '../../ui';

interface SignInFormProps {
  /** Chamado depois de a API aceitar as credenciais. */
  onSignedIn: () => Promise<void> | void;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ onSignedIn }: SignInFormProps) {
  const m = t().auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Depois de desenhar os erros, o foco vai para o primeiro campo inválido.
  useEffect(() => {
    if (focusRequest > 0) form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors = {};
    if (!email.trim()) next.email = m.signIn.emailRequired;
    else if (!EMAIL_SHAPE.test(email.trim())) next.email = m.signIn.emailInvalid;
    if (!password) next.password = m.signIn.passwordRequired;
    setErrors(next);
    setApiError(null);
    if (next.email || next.password) {
      setFocusRequest((n) => n + 1);
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) {
        setApiError(
          error.status === 401 || error.status === 400
            ? m.signIn.invalidCredentials
            : error.status === 429
              ? m.signIn.rateLimited
              : m.signIn.generic,
        );
        return;
      }
      await onSignedIn();
    } catch {
      setApiError(m.signIn.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={form} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <TextField
        label={m.email}
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        error={errors.email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
      />
      <PasswordField
        label={m.password}
        name="password"
        autoComplete="current-password"
        value={password}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
      />
      {apiError ? (
        <p role="alert" className="rounded-[10px] bg-neg-tint px-3.5 py-2.5 font-medium text-neg-text">
          {apiError}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? m.signIn.pending : m.signIn.submit}
      </Button>
      <p className="text-center text-ink-2">
        {m.signIn.noAccount}{' '}
        <Link to="/registar" className="font-medium text-pos underline underline-offset-4">
          {m.signIn.toSignUp}
        </Link>
      </p>
    </form>
  );
}

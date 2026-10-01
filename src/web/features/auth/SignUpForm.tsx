import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { authClient } from '../../api/auth';
import { t } from '../../i18n';
import { Button, PasswordField, TextField } from '../../ui';

export const MIN_PASSWORD = 12;

interface SignUpFormProps {
  /** Chamado depois de a conta ser criada (a sessão já está iniciada). */
  onSignedUp: () => Promise<void> | void;
  /** Chamado se a API disser que o registo já fechou. */
  onClosed: () => void;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpForm({ onSignedUp, onClosed }: SignUpFormProps) {
  const m = t().auth;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Depois de desenhar os erros, o foco vai para o primeiro campo inválido.
  useEffect(() => {
    if (focusRequest > 0) form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const missing = Math.max(0, MIN_PASSWORD - password.length);
  const hint =
    password.length === 0 || missing > 0
      ? m.signUp.passwordHint.replace('{n}', String(missing || MIN_PASSWORD))
      : m.signUp.passwordOk;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors = {};
    if (!name.trim()) next.name = m.signUp.nameRequired;
    if (!email.trim()) next.email = m.signIn.emailRequired;
    else if (!EMAIL_SHAPE.test(email.trim())) next.email = m.signIn.emailInvalid;
    if (password.length < MIN_PASSWORD) next.password = m.signUp.passwordShort;
    if (confirm !== password) next.confirm = m.signUp.confirmMismatch;
    setErrors(next);
    setApiError(null);
    if (Object.keys(next).length > 0) {
      setFocusRequest((n) => n + 1);
      return;
    }

    setPending(true);
    try {
      const { error } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.status === 403 || error.code === 'registration_closed') {
          onClosed();
        } else if (error.code === 'USER_ALREADY_EXISTS' || error.status === 422) {
          setApiError(m.signUp.emailTaken);
        } else if (error.code === 'PASSWORD_TOO_SHORT') {
          setApiError(m.signUp.passwordShort);
        } else {
          setApiError(m.signUp.generic);
        }
        return;
      }
      await onSignedUp();
    } catch {
      setApiError(m.signUp.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={form} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <TextField
        label={m.signUp.name}
        name="name"
        autoComplete="name"
        value={name}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <TextField
        label={m.email}
        type="email"
        name="email"
        autoComplete="email"
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
        autoComplete="new-password"
        value={password}
        hint={hint}
        error={errors.password}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
      />
      <PasswordField
        label={m.signUp.confirm}
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        error={errors.confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
        }}
      />
      {apiError ? (
        <p role="alert" className="rounded-[10px] bg-neg-tint px-3.5 py-2.5 font-medium text-neg-text">
          {apiError}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? m.signUp.pending : m.signUp.submit}
      </Button>
      <p className="text-center text-ink-2">
        {m.signUp.haveAccount}{' '}
        <Link to="/entrar" className="font-medium text-pos underline underline-offset-4">
          {m.signUp.toSignIn}
        </Link>
      </p>
    </form>
  );
}

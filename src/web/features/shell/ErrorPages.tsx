import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { Button, Logo } from '../../ui';
import { usePageTitle } from './usePageTitle';

interface MessageProps {
  title: string;
  body: string;
  /** Dentro da estrutura da aplicação (já existe `main` e navegação) ou página inteira. */
  inShell: boolean;
  children: ReactNode;
}

function Message({ title, body, inShell, children }: MessageProps) {
  usePageTitle(title);
  const content = (
    <>
      {inShell ? null : (
        <Link to="/" aria-label={t().shell.homeLink} className="mb-10 inline-block">
          <Logo size="sm" />
        </Link>
      )}
      <h1 className="font-display text-[44px] leading-none font-light tracking-[-0.02em]">{title}</h1>
      <p className="mt-4 text-ink-2">{body}</p>
      <div className="mt-8 flex flex-wrap gap-3">{children}</div>
    </>
  );
  return inShell ? (
    <div className="max-w-lg py-8">{content}</div>
  ) : (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-lg px-4 py-16 outline-none sm:px-10">
      {content}
    </main>
  );
}

const LINK_PRIMARY =
  'inline-flex h-10 items-center rounded-[10px] bg-cta px-4 text-[14px] font-semibold text-cta-ink hover:brightness-110';
const LINK_SECONDARY =
  'inline-flex h-10 items-center rounded-[10px] border border-control px-4 text-[14px] font-medium hover:bg-surface-2';

function NotFound({ inShell }: { inShell: boolean }) {
  const m = t().errors;
  return (
    <Message title={m.notFoundTitle} body={m.notFoundBody} inShell={inShell}>
      <Link to="/" className={LINK_PRIMARY}>
        {m.backHome}
      </Link>
    </Message>
  );
}

function ErrorMessage({ reset, inShell }: Pick<ErrorComponentProps, 'reset'> & { inShell: boolean }) {
  const m = t().errors;
  const router = useRouter();
  return (
    <Message title={m.title} body={m.body} inShell={inShell}>
      <Button
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        {m.retry}
      </Button>
      <Link to="/" className={LINK_SECONDARY}>
        {m.backHome}
      </Link>
    </Message>
  );
}

/** 404 em página inteira (a rota não existe). */
export function NotFoundPage() {
  return <NotFound inShell={false} />;
}

/** 404 dentro da estrutura da aplicação. */
export function InlineNotFound() {
  return <NotFound inShell />;
}

/** Erro ao carregar uma rota, em página inteira, com "tentar novamente". */
export function RouteError({ reset }: ErrorComponentProps) {
  return <ErrorMessage reset={reset} inShell={false} />;
}

/** Erro numa página da aplicação: mantém a navegação e oferece "tentar novamente". */
export function InlineRouteError({ reset }: ErrorComponentProps) {
  return <ErrorMessage reset={reset} inShell />;
}

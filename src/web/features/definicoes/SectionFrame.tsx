import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { Button, Card, SectionHeader, Skeleton } from '../../ui';

interface SectionFrameProps {
  /** Prefixo dos ids (`casas` → `casas-titulo`). */
  idPrefix: string;
  number: string;
  title: string;
  hint?: string;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}

/** Cartão de secção com título serifado, número mono e estados de carregamento e erro. */
export function SectionFrame({
  idPrefix,
  number,
  title,
  hint,
  loading,
  failed,
  onRetry,
  children,
}: SectionFrameProps) {
  const titleId = `${idPrefix}-titulo`;
  return (
    <Card aria-labelledby={titleId} aria-busy={loading ? true : undefined}>
      <SectionHeader id={titleId} number={number} title={title} />
      {hint ? <p className="-mt-2 mb-4 text-[13px] text-ink-2">{hint}</p> : null}
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-neg-text">{t().settings.loadError}</p>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t().settings.retry}
            </Button>
          ) : null}
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

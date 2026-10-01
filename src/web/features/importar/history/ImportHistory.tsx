import { useCallback, useRef, useState } from 'react';
import { isApiError } from '../../../api/client';
import type { ImportBatchDto } from '../../../api/types';
import { t } from '../../../i18n';
import { Button, Card, Skeleton } from '../../../ui';
import { fill } from '../../definicoes/helpers';
import { useImports, useUndoImport } from './api';
import { ImportRow, rowId } from './ImportRow';
import { UndoDialog } from './UndoDialog';

const PAGE_SIZE = 20;
const NBSP = String.fromCharCode(0xa0);

export interface ImportHistoryProps {
  /** Id do título (o assistente de importação pode focá-lo ou fazer scroll até ele). */
  headingId?: string;
}

/** Cartão "Histórico de importações": lista, desfazer com confirmação e estados vazio, de erro e de carga. */
export function ImportHistory({ headingId }: ImportHistoryProps) {
  const m = t().importHistory;
  const titleId = headingId ?? 'historico-titulo';
  const cardId = `${titleId}-cartao`;
  const query = useImports();
  const undo = useUndoImport();

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [target, setTarget] = useState<ImportBatchDto | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const focusAfterClose = useRef<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // alternar um espaço final faz o leitor de ecrã repetir avisos iguais
  const announce = useCallback((message: string) => {
    setNotice((prev) => (prev === message ? `${message}${NBSP}` : message));
  }, []);

  const items = query.data?.items ?? [];
  const visible = items.slice(0, limit);

  function finish(batch: ImportBatchDto, message: string) {
    focusAfterClose.current = batch.id;
    setTarget(null);
    announce(message);
  }

  function confirmUndo() {
    if (!target) return;
    const batch = target;
    undo.mutate(batch.id, {
      onSuccess: () => {
        finish(batch, m.undone);
      },
      onError: (error) => {
        if (isApiError(error, 'already_undone')) finish(batch, m.alreadyUndone);
        else if (isApiError(error, 'not_found')) finish(batch, m.notFound);
        else setDialogError(m.generic);
      },
    });
  }

  /** O botão "Desfazer" some quando a importação passa a desfeita: o foco vai para a linha (ou o cartão). */
  function restoreFocus(event: Event) {
    const id = focusAfterClose.current;
    focusAfterClose.current = null;
    event.preventDefault();
    if (id !== null) {
      (document.getElementById(rowId(id)) ?? document.getElementById(cardId))?.focus();
    } else if (opener.current?.isConnected) {
      opener.current.focus();
    }
  }

  return (
    <Card id={cardId} tabIndex={-1} aria-labelledby={titleId} aria-busy={query.isPending ? true : undefined}>
      <div className="mb-4 flex items-baseline gap-2.5">
        <span className="num text-[11px] text-ink-2" aria-hidden="true">
          {m.number}
        </span>
        <h2
          id={titleId}
          tabIndex={-1}
          className="font-display text-[22px] leading-tight font-normal tracking-[-0.01em]"
        >
          {m.title}
        </h2>
      </div>
      <p className="-mt-2 mb-4 text-[13px] text-ink-2">{m.hint}</p>

      <p
        role="status"
        aria-live="polite"
        aria-label={m.announcements}
        className={notice ? 'mb-3 text-[13px] font-medium' : 'sr-only'}
      >
        {notice}
      </p>

      {query.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-neg-text">{m.loadError}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void query.refetch();
            }}
          >
            {m.retry}
          </Button>
        </div>
      ) : query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] bg-surface-2 px-4 py-3">
          <p className="font-medium">{m.empty}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{m.emptyHint}</p>
        </div>
      ) : (
        <>
          <ul aria-label={m.list} className="border-b border-line">
            {visible.map((batch) => (
              <ImportRow
                key={batch.id}
                batch={batch}
                onUndo={(b) => {
                  opener.current =
                    document.activeElement instanceof HTMLElement ? document.activeElement : null;
                  undo.reset();
                  setDialogError(null);
                  setTarget(b);
                }}
              />
            ))}
          </ul>
          {items.length > PAGE_SIZE ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {visible.length < items.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLimit((n) => n + PAGE_SIZE);
                  }}
                >
                  {m.showMore}
                </Button>
              ) : null}
              <p className="num text-[12px] text-ink-2">
                {fill(m.showing, { shown: visible.length, total: items.length })}
              </p>
            </div>
          ) : null}
        </>
      )}

      <UndoDialog
        batch={target}
        pending={undo.isPending}
        error={dialogError}
        onConfirm={confirmUndo}
        onCancel={() => {
          setTarget(null);
        }}
        onCloseAutoFocus={restoreFocus}
      />
    </Card>
  );
}

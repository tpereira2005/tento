import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { fill } from '../../definicoes/helpers';
import { useWallets } from '../../definicoes/api';
import { useCommitImport, usePreview } from './api';
import type { LoadedFile } from './readFile';
import { StepAccount, walletName } from './StepAccount';
import { StepConfirm } from './StepConfirm';
import { StepFile } from './StepFile';
import { STEPS, StepIndicator, stepTitleId, type StepId } from './StepFrame';
import { StepPreview } from './StepPreview';

const NBSP = String.fromCharCode(0xa0);

interface Props {
  /** Conta pedida por `?conta=`; ignorada se não existir. */
  initialWalletId?: string | undefined;
  onViewHistory: () => void;
  onShowFormat: () => void;
}

/** Assistente de importação: Conta → Ficheiro → Pré-visualização → Confirmar. */
export function ImportWizard({ initialWalletId, onViewHistory, onShowFormat }: Props) {
  const m = t().import;
  const wallets = useWallets();
  const commit = useCommitImport();
  const [step, setStep] = useState<StepId>('account');
  const [chosenId, setChosenId] = useState<string | undefined>(initialWalletId);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileId, setFileId] = useState(0);
  const [notice, setNotice] = useState('');

  const list = wallets.data?.items ?? [];
  const wallet = list.find((w) => w.id === chosenId) ?? list.find((w) => w.id === initialWalletId) ?? list[0];
  const walletId = wallet?.id ?? '';
  const account = wallet ? walletName(wallet) : '';

  // alternar um espaço final faz o leitor de ecrã repetir avisos iguais
  const announce = useCallback((message: string) => {
    setNotice((prev) => (prev === message ? `${message}${NBSP}` : message));
  }, []);

  const wantsPreview = (step === 'preview' || step === 'confirm') && file !== null && walletId !== '';
  const preview = usePreview(wantsPreview ? { walletId, filename: file.name, csv: file.text, fileId } : null);
  const result = commit.data ?? null;

  // O foco vai para o título do passo novo (ou do resumo, depois de gravar).
  const focusKey = result ? 'done' : step;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(stepTitleId(step))?.focus();
    // `focusKey` muda quando o passo muda ou quando a gravação termina
  }, [focusKey, step]);

  const goTo = useCallback(
    (next: StepId) => {
      setStep(next);
      announce(fill(m.stepChanged, { n: STEPS.indexOf(next) + 1, total: STEPS.length, name: m.steps[next] }));
    },
    [announce, m],
  );

  // Aviso (derivado, sem estado) quando a análise termina.
  const data = preview.data;
  const previewError: unknown = preview.error;
  const previewNotice =
    step !== 'preview'
      ? ''
      : previewError
        ? m.preview.announce.fatal
        : data
          ? fill(m.preview.announce.ready, {
              toAdd: data.counts.toAdd,
              duplicates: data.counts.duplicates,
              conflicts: data.counts.conflicts,
              invalid: data.counts.invalid,
            })
          : '';

  function confirm() {
    if (!file || !walletId) return;
    commit.mutate(
      { walletId, filename: file.name, csv: file.text },
      {
        onSuccess: (batch) => {
          announce(
            batch.rowsAdded === 1
              ? fill(m.success.addedOne, { account })
              : fill(m.success.addedMany, { count: batch.rowsAdded, account }),
          );
        },
      },
    );
  }

  function reset() {
    commit.reset();
    setFile(null);
    goTo('file');
  }

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator current={step} />

      {step === 'account' ? (
        <StepAccount
          wallets={list}
          loading={wallets.isPending}
          failed={wallets.isError}
          onRetry={() => void wallets.refetch()}
          walletId={walletId}
          onWalletChange={setChosenId}
          onNext={() => {
            goTo('file');
          }}
        />
      ) : null}

      {step === 'file' ? (
        <StepFile
          accountName={account}
          file={file}
          onFile={(loaded) => {
            setFile(loaded);
            setFileId((n) => n + 1);
            goTo('preview');
          }}
          onBack={() => {
            goTo('account');
          }}
          onNext={() => {
            goTo('preview');
          }}
        />
      ) : null}

      {step === 'preview' && file ? (
        <StepPreview
          file={file}
          data={data}
          pending={preview.isPending}
          error={previewError ?? null}
          onRetry={() => void preview.refetch()}
          onBack={() => {
            goTo('file');
          }}
          onNext={() => {
            goTo('confirm');
          }}
          onShowFormat={onShowFormat}
        />
      ) : null}

      {step === 'confirm' && file && data ? (
        <StepConfirm
          account={account}
          file={file}
          counts={data.counts}
          pending={commit.isPending}
          error={commit.error}
          result={result}
          onBack={() => {
            commit.reset();
            goTo('preview');
          }}
          onConfirm={confirm}
          onAnother={reset}
          onViewHistory={onViewHistory}
        />
      ) : null}

      <div role="status" aria-live="polite" aria-label={m.announcements} className="sr-only">
        {notice}
      </div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="preview-notice">
        {previewNotice}
      </div>
    </div>
  );
}

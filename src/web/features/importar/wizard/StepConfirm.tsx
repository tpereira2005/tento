import { CircleCheck } from 'lucide-react';
import { isApiError } from '../../../api/client';
import type { ImportBatchDto } from '../../../api/types';
import { t } from '../../../i18n';
import { Button } from '../../../ui';
import { fill } from '../../definicoes/helpers';
import type { PreviewDto } from './api';
import { FileInfo } from './StepFile';
import { StepFrame } from './StepFrame';
import type { LoadedFile } from './readFile';

export function transactionsText(count: number): string {
  const m = t().import.confirm;
  return count === 1 ? m.transactionOne : fill(m.transactionMany, { count });
}

interface Props {
  account: string;
  file: LoadedFile;
  counts: PreviewDto['counts'];
  /** Há um pedido de gravação a decorrer. */
  pending: boolean;
  error: unknown;
  result: ImportBatchDto | null;
  onBack: () => void;
  onConfirm: () => void;
  onAnother: () => void;
  onViewHistory: () => void;
}

/** Passo 4: confirmar a gravação e, depois dela, o resumo do que foi feito. */
export function StepConfirm({
  account,
  file,
  counts,
  pending,
  error,
  result,
  onBack,
  onConfirm,
  onAnother,
  onViewHistory,
}: Props) {
  const m = t().import.confirm;
  const s = t().import.success;

  if (result) {
    const added = result.rowsAdded;
    return (
      <StepFrame step="confirm" title={s.title}>
        <div className="flex flex-col items-start gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-pos-tint text-pos">
            <CircleCheck size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="text-[16px] font-medium">
            {added === 1 ? fill(s.addedOne, { account }) : fill(s.addedMany, { count: added, account })}
          </p>
          <p className="text-ink-2">
            {fill(s.skipped, {
              duplicates: result.rowsDuplicate,
              conflicts: result.rowsConflict,
              invalid: result.rowsInvalid,
            })}
          </p>
          <p className="text-[13px] text-ink-2">{s.dashboardNote}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={onAnother}>{s.another}</Button>
            <Button variant="secondary" onClick={onViewHistory}>
              {s.history}
            </Button>
          </div>
        </div>
      </StepFrame>
    );
  }

  const apiProblem = isApiError(error) ? error : null;
  const errorText = !error
    ? null
    : apiProblem?.status === 404
      ? m.errors.notFound
      : apiProblem?.status === 413
        ? m.errors.tooLarge
        : m.errors.generic;

  return (
    <StepFrame
      step="confirm"
      title={m.title}
      lead={fill(m.summary, { count: transactionsText(counts.toAdd), account, file: file.name })}
    >
      <div className="mb-4">
        <FileInfo file={file} />
      </div>
      <p className="mb-5 text-[13px] text-ink-2">
        {fill(m.skipped, {
          duplicates: counts.duplicates,
          conflicts: counts.conflicts,
          invalid: counts.invalid,
        })}
      </p>
      {errorText ? (
        <p role="alert" className="mb-4 font-medium text-neg-text">
          {errorText}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack} disabled={pending}>
          {t().import.back}
        </Button>
        <Button onClick={onConfirm} disabled={pending || counts.toAdd === 0}>
          {pending ? m.pending : fill(m.button, { count: transactionsText(counts.toAdd) })}
        </Button>
      </div>
    </StepFrame>
  );
}

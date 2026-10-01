import type { ImportBatchDto } from '../../../api/types';
import { t } from '../../../i18n';
import { Button, Dialog } from '../../../ui';
import { fill } from '../../definicoes/helpers';
import { accountName } from './format';

interface Props {
  batch: ImportBatchDto | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** Confirmação de "Desfazer": diz exatamente quantas transações saem e de que conta. */
export function UndoDialog({ batch, pending, error, onConfirm, onCancel, onCloseAutoFocus }: Props) {
  const m = t().importHistory;
  const account = batch ? accountName(batch) : '';
  const count = batch?.rowsAdded ?? 0;
  const body = count === 1 ? fill(m.dialogBodyOne, { account }) : fill(m.dialogBodyMany, { count, account });

  return (
    <Dialog
      open={batch !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={m.dialogTitle}
      description={body}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {error ? (
        <p role="alert" className="mb-3 text-[13px] font-medium text-neg-text">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {m.cancel}
        </Button>
        <Button onClick={onConfirm} disabled={pending}>
          {m.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

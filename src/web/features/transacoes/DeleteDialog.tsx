import { useState } from 'react';
import { formatCents } from '../../../core';
import { isApiError } from '../../api/client';
import type { TxnDto } from '../../api/types';
import { t } from '../../i18n';
import { Button, Dialog } from '../../ui';
import { fill, formatIsoDate } from '../definicoes/helpers';
import { useDeleteTransaction } from './api';

interface Props {
  txn: TxnDto;
  onClose: () => void;
  announce: (message: string) => void;
}

/** Confirmação de apagar: diz a data, o montante e a conta da transação. */
export function DeleteDialog({ txn, onClose, announce }: Props) {
  const d = t().transactions.delete;
  const tt = t().transactions;
  const remove = useDeleteTransaction();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    remove.mutate(txn.id, {
      onSuccess: () => {
        announce(tt.announce.deleted);
        onClose();
      },
      onError: (err) => {
        setError(isApiError(err, 'not_found') ? d.notFound : d.generic);
      },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={d.title}
      description={fill(d.body, {
        type: txn.type === 'deposit' ? tt.table.deposit : tt.table.withdrawal,
        amount: formatCents(txn.amountCents),
        date: formatIsoDate(String(txn.date)),
        account: `${txn.profileName} · ${txn.bookmakerName}`,
      })}
    >
      {error ? (
        <p role="alert" className="mb-3 text-[13px] font-medium text-neg-text">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {tt.form.cancel}
        </Button>
        <Button onClick={confirm} disabled={remove.isPending}>
          {d.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

import { useState, type SyntheticEvent } from 'react';
import type { TxnDto, WalletDto } from '../../api/types';
import { t } from '../../i18n';
import { Button, Dialog, Segmented, Select, TextField } from '../../ui';
import { fill } from '../definicoes/helpers';
import { useCreateTransaction, useUpdateTransaction, type TxnPatch } from './api';
import {
  amountFeedback,
  amountText,
  NOTE_MAX,
  serverMessage,
  validateForm,
  type FieldErrors,
  type FormValues,
  type TxnType,
} from './form';

export type DialogMode = { kind: 'create' } | { kind: 'edit'; txn: TxnDto };

interface Props {
  mode: DialogMode;
  wallets: readonly WalletDto[];
  /** Data de hoje (`AAAA-MM-DD`), usada como valor inicial ao adicionar. */
  today: string;
  /** Conta pré-escolhida ao adicionar (a do filtro, quando há uma só). */
  defaultWalletId?: string | undefined;
  onClose: () => void;
  announce: (message: string) => void;
}

export const walletLabel = (w: { profileName: string; bookmakerName: string }) =>
  `${w.profileName} · ${w.bookmakerName}`;

function initialValues(mode: DialogMode, wallets: readonly WalletDto[], today: string, preferred?: string) {
  if (mode.kind === 'edit') {
    const x = mode.txn;
    return {
      walletId: x.walletId,
      date: String(x.date),
      type: x.type,
      amount: amountText(x.amountCents),
      note: x.note ?? '',
    } satisfies FormValues;
  }
  const first = wallets.find((w) => w.id === preferred) ?? wallets[0];
  return {
    walletId: first?.id ?? '',
    date: today,
    type: 'deposit',
    amount: '',
    note: '',
  } satisfies FormValues;
}

/** Formulário de adicionar/editar uma transação, num diálogo. */
export function TransactionDialog({ mode, wallets, today, defaultWalletId, onClose, announce }: Props) {
  const f = t().transactions.form;
  const editing = mode.kind === 'edit';
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(mode, wallets, today, defaultWalletId),
  );
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const pending = create.isPending || update.isPending;

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setServerError(null);
  };

  const { errors, cents } = validateForm(values);
  const amount = amountFeedback(values.amount);
  const shown: FieldErrors = submitted ? errors : {};
  // o valor dá feedback logo ao escrever; o resto só depois de tentar guardar
  const amountError = values.amount.trim() !== '' || submitted ? amount.error : undefined;
  const wallet = wallets.find((w) => w.id === values.walletId);

  function done(message: string) {
    announce(message);
    onClose();
  }

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || cents === undefined) return;
    const note = values.note.trim();
    const onError = (err: unknown) => {
      setServerError(serverMessage(err));
    };

    if (mode.kind === 'create') {
      create.mutate(
        {
          walletId: values.walletId,
          date: values.date,
          type: values.type,
          amountCents: cents,
          ...(note !== '' ? { note } : {}),
        },
        {
          onSuccess: () => {
            done(t().transactions.announce.created);
          },
          onError,
        },
      );
      return;
    }

    const before = mode.txn;
    const patch: TxnPatch = {};
    if (values.date !== String(before.date)) patch.date = values.date;
    if (values.type !== before.type) patch.type = values.type;
    if (cents !== before.amountCents) patch.amountCents = cents;
    if (note !== (before.note ?? '')) patch.note = note === '' ? null : note;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { id: before.id, patch },
      {
        onSuccess: () => {
          done(t().transactions.announce.updated);
        },
        onError,
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? f.editTitle : f.addTitle}
      description={editing ? f.editDescription : f.description}
    >
      {wallets.length === 0 ? (
        <p className="text-ink-2">{f.noAccounts}</p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {mode.kind === 'edit' && mode.txn.source === 'csv' ? (
            <p className="rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-[13px]">{f.csvNote}</p>
          ) : null}
          {serverError ? (
            <p role="alert" className="text-[13px] font-medium text-neg-text">
              {serverError}
            </p>
          ) : null}

          {editing ? (
            // A conta não muda ao editar: mostra-se como texto (não é um campo focável).
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">{f.account}</span>
              <p className="rounded-[10px] bg-surface-2 px-3.5 py-2.5">
                {wallet ? walletLabel(wallet) : `${mode.txn.profileName} · ${mode.txn.bookmakerName}`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Select
                label={f.account}
                value={values.walletId}
                options={wallets.map((w) => ({ value: w.id, label: walletLabel(w) }))}
                onValueChange={(v) => {
                  set('walletId', v);
                }}
                className="w-full justify-between"
              />
              {shown.walletId ? (
                <p className="text-[12px] font-medium text-neg-text">{shown.walletId}</p>
              ) : null}
            </div>
          )}

          <TextField
            label={f.date}
            type="date"
            min="1900-01-01"
            max="2999-12-31"
            value={values.date}
            error={shown.date}
            onChange={(e) => {
              set('date', e.target.value);
            }}
          />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">{f.type}</legend>
            <Segmented
              aria-label={f.type}
              value={values.type}
              options={[
                { value: 'deposit', label: f.deposit },
                { value: 'withdrawal', label: f.withdrawal },
              ]}
              onValueChange={(v) => {
                set('type', v as TxnType);
              }}
              className="self-start"
            />
          </fieldset>

          <TextField
            label={f.amount}
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            error={amountError}
            hint={amount.parsed ?? f.amountHint}
            onChange={(e) => {
              set('amount', e.target.value);
            }}
          />

          <div>
            <TextField
              label={f.note}
              autoComplete="off"
              value={values.note}
              error={shown.note}
              onChange={(e) => {
                set('note', e.target.value);
              }}
            />
            <p className="num mt-1 text-right text-[12px] text-ink-2">
              {fill(f.noteCounter, { n: values.note.length, max: NOTE_MAX })}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>
              {f.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? f.saving : f.save}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

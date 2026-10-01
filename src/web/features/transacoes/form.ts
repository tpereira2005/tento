import { isApiError } from '../../api/client';
import { formatCents, makeIsoDate, parseAmount, parseDate } from '../../../core';
import { t } from '../../i18n';

export const NOTE_MAX = 500;

export type TxnType = 'deposit' | 'withdrawal';

export interface FormValues {
  walletId: string;
  date: string;
  type: TxnType;
  amount: string;
  note: string;
}

export type FieldErrors = Partial<Record<'walletId' | 'date' | 'amount' | 'note', string>>;

/** Valor em cêntimos como texto editável ("1234,50"), sem separador de milhares. */
export function amountText(cents: number): string {
  return `${String(Math.floor(cents / 100))},${String(cents % 100).padStart(2, '0')}`;
}

export interface AmountFeedback {
  cents?: number;
  error?: string;
  /** "= 1 234,56 €" quando o texto é válido. */
  parsed?: string;
}

/** Lê o que a pessoa escreveu e diz, em tempo real, o valor percebido ou o que está errado. */
export function amountFeedback(raw: string): AmountFeedback {
  const e = t().transactions.form.errors;
  if (raw.trim() === '') return { error: e.amountEmpty };
  const r = parseAmount(raw);
  if (!r.ok) {
    if (r.error === 'too_many_decimals') return { error: e.amountDecimals };
    if (r.error === 'out_of_range') return { error: e.amountRange };
    return { error: r.error === 'empty' ? e.amountEmpty : e.amountInvalid };
  }
  if (r.value <= 0) return { error: e.amountPositive };
  return {
    cents: r.value,
    parsed: t().transactions.form.amountParsed.replace('{value}', formatCents(r.value)),
  };
}

/** `AAAA-MM-DD` válido, a partir de 1900. */
export function isValidDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  return makeIsoDate(Number(m[1]), Number(m[2]), Number(m[3])).ok && parseDate(value).ok;
}

export function validateForm(values: FormValues): { errors: FieldErrors; cents: number | undefined } {
  const e = t().transactions.form.errors;
  const errors: FieldErrors = {};
  if (values.walletId === '') errors.walletId = e.account;
  if (!isValidDate(values.date)) errors.date = e.date;
  const amount = amountFeedback(values.amount);
  if (amount.error) errors.amount = amount.error;
  if (values.note.trim().length > NOTE_MAX) errors.note = e.noteTooLong;
  return { errors, cents: amount.cents };
}

/** Mensagem para um erro do servidor: 422 (dados rejeitados), 404 (conta ou transação já não existe). */
export function serverMessage(error: unknown): string {
  const e = t().transactions.form.errors;
  if (isApiError(error)) {
    if (error.status === 422 || error.status === 400) return e.rejected;
    if (error.status === 404) return e.notFound;
  }
  return e.generic;
}

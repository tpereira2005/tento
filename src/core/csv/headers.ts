import { err, ok, type Result, type TxnType } from '../types';

export type ColumnField = 'date' | 'type' | 'amount';

export interface ColumnMap {
  date: number;
  type: number;
  amount: number;
}

/** Minúsculas, sem BOM, sem acentos e só letras: `" Depósito "` → `"deposito"`. */
export function normalizeToken(raw: string): string {
  // o BOM (U+FEFF) e tudo o que não é letra saem no último passo
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
}

/** Nomes de cabeçalho aceites (já normalizados). Inclui os erros de ortografia do formato canónico. */
export const HEADER_ALIASES: Record<ColumnField, readonly string[]> = {
  date: ['date', 'data', 'dt', 'dia', 'transactiondate', 'fecha'],
  type: ['type', 'tipe', 'tipo', 'kind', 'movimento', 'operacao', 'operation'],
  amount: ['value', 'vaule', 'valor', 'amount', 'montante', 'quantia', 'importe'],
};

const FIELDS: readonly ColumnField[] = ['date', 'type', 'amount'];

/**
 * Descobre que coluna é cada campo. Em caso de repetição ganha a primeira.
 * O erro lista os campos em falta (por ordem: data, tipo, valor).
 */
export function mapHeaders(cells: readonly string[]): Result<ColumnMap, { missing: ColumnField[] }> {
  const normalized = cells.map(normalizeToken);
  const found: Partial<Record<ColumnField, number>> = {};
  for (const field of FIELDS) {
    const idx = normalized.findIndex((c) => HEADER_ALIASES[field].includes(c));
    if (idx >= 0) found[field] = idx;
  }
  const missing = FIELDS.filter((f) => found[f] === undefined);
  if (found.date === undefined || found.type === undefined || found.amount === undefined) {
    return err({ missing });
  }
  return ok({ date: found.date, type: found.type, amount: found.amount });
}

const TYPE_ALIASES: Record<TxnType, readonly string[]> = {
  deposit: ['deposit', 'deposito', 'dep', 'depositar'],
  withdrawal: ['withdrawal', 'withdraw', 'withdrawl', 'levantamento', 'levantar', 'saque', 'retirada'],
};

/** Interpreta o tipo de uma linha (`Deposit`, `Levantamento`, `with drawal`…). `null` se não reconhecer. */
export function normalizeType(raw: string): TxnType | null {
  const token = normalizeToken(raw);
  if (TYPE_ALIASES.deposit.includes(token)) return 'deposit';
  if (TYPE_ALIASES.withdrawal.includes(token)) return 'withdrawal';
  return null;
}

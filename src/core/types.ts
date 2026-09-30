/** Tipos partilhados do domínio. Valores em cêntimos inteiros; datas como texto ISO. */

/** Montante em cêntimos (inteiro seguro). */
export type Cents = number;

/** Data de calendário `AAAA-MM-DD`, sem hora nem fuso. Só se cria através de `src/core/dates.ts`. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

/** Mês de calendário `AAAA-MM`. */
export type MonthKey = string & { readonly __brand: 'MonthKey' };

export type TxnType = 'deposit' | 'withdrawal';

/** Uma transação de uma conta (perfil × casa). `amountCents` é sempre positivo; o tipo dá o sentido. */
export interface Transaction {
  id: string;
  walletId: string;
  date: IsoDate;
  type: TxnType;
  amountCents: Cents;
  /** Ordem dentro do mesmo dia (posição no ficheiro), para desempatar transações do mesmo dia. */
  seq: number;
}

/** Conta = perfil × casa. */
export interface WalletRef {
  id: string;
  profileId: string;
  bookmakerId: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const err = <E>(error: E): { ok: false; error: E } => ({ ok: false, error });

/** Efeito de uma transação no resultado líquido: levantamentos somam, depósitos subtraem. */
export function netEffect(txn: Pick<Transaction, 'type' | 'amountCents'>): Cents {
  return txn.type === 'withdrawal' ? txn.amountCents : -txn.amountCents;
}

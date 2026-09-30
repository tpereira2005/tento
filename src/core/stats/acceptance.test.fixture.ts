import { addMonths } from '../dates';
import type { IsoDate, MonthKey, Transaction, WalletRef } from '../types';

/** Dados sintéticos do conjunto de aceitação (out 2025 → set 2026), iguais aos das pranchas aprovadas. */
export const ACCEPTANCE_DEPOSITS_EUR = [300, 285, 460, 320, 410, 240, 345, 390, 280, 420, 315, 515];
export const ACCEPTANCE_WITHDRAWALS_CENTS = [
  42000, 20000, 25000, 36500, 25000, 55000, 25000, 25000, 34000, 16000, 35000, 23050,
];
export const ACCEPTANCE_FIRST_MONTH = '2025-10' as MonthKey;
export const ACCEPTANCE_LAST_MONTH = '2026-09' as MonthKey;

export const acceptanceWallets: WalletRef[] = [
  { id: 'w-ana-a', profileId: 'ana', bookmakerId: 'casa-a' },
  { id: 'w-ana-b', profileId: 'ana', bookmakerId: 'casa-b' },
  { id: 'w-rui-a', profileId: 'rui', bookmakerId: 'casa-a' },
];

export function makeTxn(
  seq: number,
  walletId: string,
  date: string,
  type: 'deposit' | 'withdrawal',
  amountCents: number,
): Transaction {
  return { id: `t${String(seq)}`, walletId, date: date as IsoDate, type, amountCents, seq };
}

/**
 * Cada mês tem dois depósitos (dias 05 e 28) e dois levantamentos (dias 10 e 20), repartidos por contas.
 * Totais mensais exatamente como os da lista acima.
 */
export function acceptanceTransactions(): Transaction[] {
  const out: Transaction[] = [];
  let seq = 0;
  const wallets = acceptanceWallets.map((w) => w.id);
  for (let i = 0; i < 12; i++) {
    const month = addMonths(ACCEPTANCE_FIRST_MONTH, i);
    const dep = (ACCEPTANCE_DEPOSITS_EUR[i] ?? 0) * 100;
    const wd = ACCEPTANCE_WITHDRAWALS_CENTS[i] ?? 0;
    const w1 = wallets[i % 3] ?? 'w-ana-a';
    const w2 = wallets[(i + 1) % 3] ?? 'w-ana-b';
    const dep1 = Math.floor(dep / 2);
    const wd1 = Math.floor(wd / 2);
    out.push(makeTxn(seq++, w1, `${month}-05`, 'deposit', dep1));
    out.push(makeTxn(seq++, w1, `${month}-10`, 'withdrawal', wd1));
    out.push(makeTxn(seq++, w2, `${month}-20`, 'withdrawal', wd - wd1));
    out.push(makeTxn(seq++, w2, `${month}-28`, 'deposit', dep - dep1));
  }
  return out;
}

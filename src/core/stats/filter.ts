import type { IsoDate, Transaction, WalletRef } from '../types';

export interface TransactionFilter {
  walletIds?: readonly string[];
  profileIds?: readonly string[];
  bookmakerIds?: readonly string[];
  /** Data inicial, inclusive. */
  from?: IsoDate;
  /** Data final, inclusive. */
  to?: IsoDate;
}

/**
 * Filtra transações por conta, perfil, casa e intervalo de datas (inclusivo).
 * Um critério em falta não filtra. Critérios de perfil/casa excluem transações de contas desconhecidas.
 * Mantém a ordem de entrada.
 */
export function filterTransactions(
  txns: readonly Transaction[],
  wallets: readonly WalletRef[],
  filter: TransactionFilter = {},
): Transaction[] {
  const { walletIds, profileIds, bookmakerIds, from, to } = filter;
  const byId = new Map(wallets.map((w) => [w.id, w]));
  return txns.filter((t) => {
    if (from !== undefined && t.date < from) return false;
    if (to !== undefined && t.date > to) return false;
    if (walletIds && !walletIds.includes(t.walletId)) return false;
    if (profileIds || bookmakerIds) {
      const w = byId.get(t.walletId);
      if (!w) return false;
      if (profileIds && !profileIds.includes(w.profileId)) return false;
      if (bookmakerIds && !bookmakerIds.includes(w.bookmakerId)) return false;
    }
    return true;
  });
}

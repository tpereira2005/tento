import type { Cents, Transaction, WalletRef } from '../types';

export type BreakdownBy = 'wallet' | 'profile' | 'bookmaker';

export const UNKNOWN_ID = '__unknown__';

export interface BreakdownRow {
  id: string;
  depositedCents: Cents;
  withdrawnCents: Cents;
  netCents: Cents;
  /** |líquido| / Σ|líquido| das linhas (0 quando o total é 0). */
  share: number;
}

/**
 * Agrupa por conta, perfil ou casa. Ordena por |líquido| decrescente e depois por id.
 * Transações de contas desconhecidas ficam sob `__unknown__`.
 */
export function breakdown(
  txns: readonly Transaction[],
  wallets: readonly WalletRef[],
  by: BreakdownBy,
): BreakdownRow[] {
  const byWallet = new Map(wallets.map((w) => [w.id, w]));
  const acc = new Map<string, { deposited: Cents; withdrawn: Cents }>();
  for (const t of txns) {
    const w = byWallet.get(t.walletId);
    const id = !w ? UNKNOWN_ID : by === 'wallet' ? w.id : by === 'profile' ? w.profileId : w.bookmakerId;
    const row = acc.get(id) ?? { deposited: 0, withdrawn: 0 };
    if (t.type === 'deposit') row.deposited += t.amountCents;
    else row.withdrawn += t.amountCents;
    acc.set(id, row);
  }
  let totalAbs = 0;
  const rows = [...acc].map(([id, v]) => {
    const netCents = v.withdrawn - v.deposited;
    totalAbs += Math.abs(netCents);
    return { id, depositedCents: v.deposited, withdrawnCents: v.withdrawn, netCents, share: 0 };
  });
  for (const r of rows) r.share = totalAbs === 0 ? 0 : Math.abs(r.netCents) / totalAbs;
  return rows.sort(
    (a, b) => Math.abs(b.netCents) - Math.abs(a.netCents) || Number(a.id > b.id) - Number(a.id < b.id),
  );
}

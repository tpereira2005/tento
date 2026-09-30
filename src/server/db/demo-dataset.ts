import type { ParsedRow } from '../../core/csv';
import { addMonths } from '../../core/dates';
import { DEMO_DEPOSITS_EUR, DEMO_FIRST_MONTH, DEMO_WITHDRAWALS_CENTS } from '../../core/stats/demo-series';
import type { IsoDate, TxnType } from '../../core/types';

/*
 * Dados de demonstração (sintéticos): a série de 12 meses de src/core/stats/demo-series.ts repartida por
 * três contas. Resultados líquidos por conta: Ana·Casa A −512,30 €, Ana·Casa B −95,20 €, Rui·Casa A −57,00 €.
 * Totais: depositado 4 280,00 €, levantado 3 615,50 €.
 */

export type DemoWalletKey = 'ana-a' | 'ana-b' | 'rui-a';

export const DEMO_BOOKMAKERS = ['Casa A', 'Casa B'] as const;
export const DEMO_PROFILES = ['Ana', 'Rui'] as const;
export const DEMO_WALLETS: readonly { key: DemoWalletKey; profile: string; bookmaker: string }[] = [
  { key: 'ana-a', profile: 'Ana', bookmaker: 'Casa A' },
  { key: 'ana-b', profile: 'Ana', bookmaker: 'Casa B' },
  { key: 'rui-a', profile: 'Rui', bookmaker: 'Casa A' },
];

const RUI_DEPOSIT_CENTS = 5_000;
const RUI_WITHDRAWN_TOTAL = 54_300;
const ANA_B_DEPOSIT_CENTS = 10_000;
const ANA_B_WITHDRAWN_TOTAL = 110_480;

/** Reparte `total` por `parts` de forma inteira, com o resto nas primeiras partes. */
function spread(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

export function demoRows(): Record<DemoWalletKey, ParsedRow[]> {
  const out: Record<DemoWalletKey, ParsedRow[]> = { 'ana-a': [], 'ana-b': [], 'rui-a': [] };
  const push = (key: DemoWalletKey, date: string, type: TxnType, amountCents: number) => {
    const rows = out[key];
    rows.push({ line: rows.length + 2, date: date as IsoDate, type, amountCents, seq: 0 });
  };
  const ruiWithdrawn = spread(RUI_WITHDRAWN_TOTAL, 12);
  const anaBWithdrawn = spread(ANA_B_WITHDRAWN_TOTAL, 12);

  for (let i = 0; i < 12; i++) {
    const month = addMonths(DEMO_FIRST_MONTH, i);
    const deposits = (DEMO_DEPOSITS_EUR[i] ?? 0) * 100;
    const withdrawals = DEMO_WITHDRAWALS_CENTS[i] ?? 0;
    const ruiW = ruiWithdrawn[i] ?? 0;
    const anaBW = anaBWithdrawn[i] ?? 0;

    const anaADeposits = deposits - RUI_DEPOSIT_CENTS - ANA_B_DEPOSIT_CENTS;
    const anaAWithdrawals = withdrawals - ruiW - anaBW;
    const depositFirst = Math.floor(anaADeposits / 2);
    const withdrawalFirst = Math.floor(anaAWithdrawals / 2);

    push('ana-a', `${month}-05`, 'deposit', depositFirst);
    push('ana-a', `${month}-10`, 'withdrawal', withdrawalFirst);
    push('ana-a', `${month}-20`, 'withdrawal', anaAWithdrawals - withdrawalFirst);
    push('ana-a', `${month}-28`, 'deposit', anaADeposits - depositFirst);
    push('ana-b', `${month}-12`, 'deposit', ANA_B_DEPOSIT_CENTS);
    push('ana-b', `${month}-15`, 'withdrawal', anaBW);
    push('rui-a', `${month}-08`, 'deposit', RUI_DEPOSIT_CENTS);
    push('rui-a', `${month}-22`, 'withdrawal', ruiW);
  }
  return out;
}

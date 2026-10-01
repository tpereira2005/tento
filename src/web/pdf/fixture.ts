import { addMonths } from '../../core/dates';
import { breakdown, monthlySeries, summarize, type BreakdownRow } from '../../core/stats';
import {
  acceptanceTransactions,
  acceptanceWallets,
  ACCEPTANCE_FIRST_MONTH,
} from '../../core/stats/acceptance.test.fixture';
import type { IsoDate, Transaction } from '../../core/types';
import { ptReportLabels } from './labels';
import type { ReportInput, ReportRow, ReportTransaction } from './types';

/*
 * Relatório de demonstração (sintético) para testes e capturas: a série de aceitação, com perfis
 * "Ana" e "Rui" e casas "Casa A" e "Casa B". Totais: depositado 4 280,00 €, levantado 3 615,50 €.
 */

const WALLET_NAMES: Record<string, { profile: string; bookmaker: string }> = {
  'w-ana-a': { profile: 'Ana', bookmaker: 'Casa A' },
  'w-ana-b': { profile: 'Ana', bookmaker: 'Casa B' },
  'w-rui-a': { profile: 'Rui', bookmaker: 'Casa A' },
};

const NOTES = [null, 'Reforço', null, 'Bónus de boas-vindas', null, 'Levantamento parcial', null];

const toRows = (rows: BreakdownRow[], name: (id: string) => string): ReportRow[] =>
  rows.map((r) => ({
    label: name(r.id),
    netCents: r.netCents,
    depositedCents: r.depositedCents,
    withdrawnCents: r.withdrawnCents,
    share: r.share,
  }));

const accountName = (id: string) => {
  const w = WALLET_NAMES[id];
  return w ? `${w.profile} · ${w.bookmaker}` : id;
};

export function toReportTransactions(txns: readonly Transaction[]): ReportTransaction[] {
  return [...txns]
    .sort((a, b) => (a.date === b.date ? b.seq - a.seq : a.date < b.date ? 1 : -1))
    .map((t, i) => ({
      date: t.date,
      account: accountName(t.walletId),
      type: t.type,
      amountCents: t.amountCents,
      note: NOTES[i % NOTES.length] ?? null,
    }));
}

/** `extraTransactions` acrescenta movimentos sintéticos (teste de volume) sem alterar o resumo. */
export function demoReportInput(extraTransactions = 0): ReportInput {
  const txns = acceptanceTransactions();
  const monthly = monthlySeries(txns);
  const summary = summarize(txns, { today: '2026-09-30' as IsoDate });
  const rows = toReportTransactions(txns);
  for (let i = 0; i < extraTransactions; i += 1) {
    const month = addMonths(ACCEPTANCE_FIRST_MONTH, i % 12);
    rows.push({
      date: `${month}-${String(1 + (i % 27)).padStart(2, '0')}`,
      account: accountName(acceptanceWallets[i % 3]?.id ?? ''),
      type: i % 3 === 0 ? 'withdrawal' : 'deposit',
      amountCents: 1000 + ((i * 7919) % 90000),
      note: i % 2 === 0 ? `Movimento ${String(i)} de teste` : null,
    });
  }
  return {
    generatedOn: '2026-09-30',
    title: 'Relatório · out 2025 – set 2026',
    scope: {
      profile: 'Todos os perfis',
      bookmaker: 'Todas as casas',
      period: 'out 2025 – set 2026',
      accounts: 3,
    },
    summary: {
      depositedCents: summary.depositedCents,
      withdrawnCents: summary.withdrawnCents,
      netCents: summary.netCents,
      positiveMonths: summary.positiveMonths,
      months: summary.months,
      avgMonthlyNetCents: summary.avgMonthlyNetCents,
      bestMonth: summary.bestMonth,
      worstMonth: summary.worstMonth,
      withdrawnRatio: summary.withdrawnRatio,
    },
    monthly: monthly.map((m) => ({
      month: m.month,
      depositedCents: m.depositedCents,
      withdrawnCents: m.withdrawnCents,
      netCents: m.netCents,
      cumulativeCents: m.cumulativeCents,
    })),
    breakdown: {
      profiles: toRows(breakdown(txns, acceptanceWallets, 'profile'), (id) => (id === 'ana' ? 'Ana' : 'Rui')),
      bookmakers: toRows(breakdown(txns, acceptanceWallets, 'bookmaker'), (id) =>
        id === 'casa-a' ? 'Casa A' : 'Casa B',
      ),
      accounts: toRows(breakdown(txns, acceptanceWallets, 'wallet'), accountName),
    },
    insights: [
      'Ao fim de 12 meses o resultado líquido é de −664,50 €.',
      'Cinco dos 12 meses terminaram positivos.',
      'A conta Ana · Casa A concentra a maior parte do resultado negativo.',
    ],
    transactions: rows,
    labels: ptReportLabels,
  };
}

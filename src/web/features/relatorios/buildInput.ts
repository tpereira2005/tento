import { isoDateFromEpochMs, UNKNOWN_ID, type BreakdownRow, type Insight, type IsoDate } from '../../../core';
import { api } from '../../api/client';
import type { BookmakerDto, ListDto, ProfileDto, TxnDto, WalletDto } from '../../api/types';
import { t } from '../../i18n';
import type { ReportInput, ReportRow, ReportTransaction } from '../../pdf/types';
import type { DashboardDto } from '../painel/api';
import { fill, periodSpan } from '../painel/derive';
import { insightPlainText } from '../painel/insightText';
import { reportQueryParams, type ReportFilters } from './search';

/** Linhas pedidas por página (o máximo da API): o relatório pagina até ao fim, sem limite total. */
export const REPORT_PAGE_SIZE = 200;

interface TxnPage {
  items: TxnDto[];
  nextCursor: string | null;
  total: number;
}

type Fetcher = typeof api;

export interface CollectDeps {
  /** Por omissão, o cliente da API. */
  fetchJson?: Fetcher;
  /** Chamado com o número de transações recolhidas até agora (0 no início). */
  onProgress?: (loaded: number) => void;
  /** Hoje (`AAAA-MM-DD`); por omissão o dia corrente. */
  today?: IsoDate;
}

export function reportFilename(today: string): string {
  return `tento-relatorio-${today}.pdf`;
}

/** Contas do âmbito: as que pertencem ao perfil e à casa escolhidos. */
export function countScopeWallets(
  wallets: readonly Pick<WalletDto, 'profileId' | 'bookmakerId'>[],
  filters: Pick<ReportFilters, 'profileId' | 'bookmakerId'>,
): number {
  return wallets.filter(
    (w) =>
      (!filters.profileId || w.profileId === filters.profileId) &&
      (!filters.bookmakerId || w.bookmakerId === filters.bookmakerId),
  ).length;
}

/** Troca os ids da repartição pelos nomes. Ids sem nome (contas apagadas) ficam com o texto de "desconhecida". */
export function labelRows(
  rows: readonly BreakdownRow[],
  nameOf: (id: string) => string | undefined,
  unknown: string,
): ReportRow[] {
  return rows.map((r) => ({
    label: (r.id === UNKNOWN_ID ? undefined : nameOf(r.id)) ?? unknown,
    netCents: r.netCents,
    depositedCents: r.depositedCents,
    withdrawnCents: r.withdrawnCents,
    share: r.share,
  }));
}

export function mapTransactions(items: readonly TxnDto[]): ReportTransaction[] {
  return items.map((x) => ({
    date: String(x.date),
    account: `${x.profileName} · ${x.bookmakerName}`,
    type: x.type,
    amountCents: x.amountCents,
    note: x.note,
  }));
}

/** Texto simples de cada destaque (o mesmo texto do Painel, sem markup). */
export function insightsToPlainText(insights: readonly Insight[]): string[] {
  return insights.map(insightPlainText).filter((x): x is string => x !== null);
}

export interface Catalog {
  profiles: readonly ProfileDto[];
  bookmakers: readonly BookmakerDto[];
  wallets: readonly WalletDto[];
}

/** Junta tudo no formato do documento. Sem I/O: recebe os dados já recolhidos. */
export function buildReportInput(args: {
  filters: ReportFilters;
  dashboard: DashboardDto;
  transactions: readonly TxnDto[];
  catalog: Catalog;
  insights: string[];
  today: IsoDate;
  labels: ReportInput['labels'];
}): ReportInput {
  const { filters, dashboard, transactions, catalog, insights, today, labels } = args;
  const m = t().reports;
  const s = dashboard.summary;
  const unknown = m.pdf.unknownAccount;
  const profileName = (id: string) => catalog.profiles.find((p) => p.id === id)?.name;
  const bookmakerName = (id: string) => catalog.bookmakers.find((b) => b.id === id)?.name;
  const walletName = (id: string) => {
    const w = catalog.wallets.find((x) => x.id === id);
    return w ? `${w.profileName} · ${w.bookmakerName}` : undefined;
  };
  return {
    generatedOn: today,
    title: m.pdf.title,
    scope: {
      profile: (filters.profileId ? profileName(filters.profileId) : undefined) ?? m.pdf.allProfiles,
      bookmaker:
        (filters.bookmakerId ? bookmakerName(filters.bookmakerId) : undefined) ?? m.pdf.allBookmakers,
      period: periodSpan(dashboard.monthly) ?? m.preview.noPeriod,
      accounts: countScopeWallets(catalog.wallets, filters),
    },
    summary: {
      depositedCents: s.depositedCents,
      withdrawnCents: s.withdrawnCents,
      netCents: s.netCents,
      positiveMonths: s.positiveMonths,
      months: s.months,
      avgMonthlyNetCents: s.avgMonthlyNetCents,
      bestMonth: s.bestMonth,
      worstMonth: s.worstMonth,
      withdrawnRatio: s.withdrawnRatio,
    },
    monthly: dashboard.monthly.map((p) => ({
      month: p.month,
      depositedCents: p.depositedCents,
      withdrawnCents: p.withdrawnCents,
      netCents: p.netCents,
      cumulativeCents: p.cumulativeCents,
    })),
    breakdown: {
      profiles: labelRows(dashboard.breakdown.profile, profileName, unknown),
      bookmakers: labelRows(dashboard.breakdown.bookmaker, bookmakerName, unknown),
      accounts: labelRows(dashboard.breakdown.wallet, walletName, unknown),
    },
    insights,
    transactions: mapTransactions(transactions),
    labels,
  };
}

/** Todas as transações do âmbito, da mais recente para a mais antiga, por páginas de cursor. */
export async function fetchAllTransactions(
  filters: ReportFilters,
  fetchJson: Fetcher,
  onProgress?: (loaded: number) => void,
): Promise<TxnDto[]> {
  const all: TxnDto[] = [];
  let cursor: string | undefined;
  onProgress?.(0);
  do {
    const page: TxnPage = await fetchJson<TxnPage>('/transactions', {
      query: { ...reportQueryParams(filters), limit: REPORT_PAGE_SIZE, cursor },
    });
    all.push(...page.items);
    onProgress?.(all.length);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return all;
}

/** Recolhe tudo o que o PDF precisa: números, nomes e todas as transações do âmbito. */
export async function collectReportInput(
  filters: ReportFilters,
  deps: CollectDeps = {},
  labels?: ReportInput['labels'],
): Promise<ReportInput> {
  const fetchJson = deps.fetchJson ?? api;
  const today = deps.today ?? isoDateFromEpochMs(Date.now());
  const [dashboard, profiles, bookmakers, wallets] = await Promise.all([
    fetchJson<DashboardDto>('/stats/dashboard', { query: reportQueryParams(filters) }),
    fetchJson<ListDto<ProfileDto>>('/profiles'),
    fetchJson<ListDto<BookmakerDto>>('/bookmakers'),
    fetchJson<ListDto<WalletDto>>('/wallets'),
  ]);
  const transactions = await fetchAllTransactions(filters, fetchJson, deps.onProgress);
  const insights = insightsToPlainText(dashboard.insights);
  const reportLabels = labels ?? (await import('../../pdf/labels')).ptReportLabels;
  return buildReportInput({
    filters,
    dashboard,
    transactions,
    catalog: { profiles: profiles.items, bookmakers: bookmakers.items, wallets: wallets.items },
    insights,
    today,
    labels: reportLabels,
  });
}

/** Texto do contador de transações ("1 transação" / "N transações"). */
export function transactionCount(n: number): string {
  const m = t().reports.preview;
  return n === 1 ? m.countOne : fill(m.countMany, { n });
}

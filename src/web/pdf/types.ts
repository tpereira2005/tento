import type { Messages } from '../i18n/pt-PT';

/** Textos fixos do PDF (chaves de `report` nos catálogos i18n) mais os meses abreviados. */
export type ReportLabels = Messages['report'] & { monthsShort: readonly string[] };

export interface ReportRow {
  label: string;
  netCents: number;
  depositedCents: number;
  withdrawnCents: number;
  /** |líquido| / Σ|líquido| das linhas, de 0 a 1. */
  share: number;
}

export interface ReportMonthly {
  month: string;
  depositedCents: number;
  withdrawnCents: number;
  netCents: number;
  cumulativeCents: number;
}

export interface ReportTransaction {
  date: string;
  account: string;
  type: 'deposit' | 'withdrawal';
  amountCents: number;
  note: string | null;
}

export interface ReportSummary {
  depositedCents: number;
  withdrawnCents: number;
  netCents: number;
  positiveMonths: number;
  months: number;
  avgMonthlyNetCents: number;
  bestMonth: { month: string; netCents: number } | null;
  worstMonth: { month: string; netCents: number } | null;
  withdrawnRatio: number | null;
}

/** Tudo o que o documento precisa; não faz nenhum cálculo de negócio nem tem texto fixo próprio. */
export interface ReportInput {
  /** AAAA-MM-DD */
  generatedOn: string;
  title: string;
  scope: { profile: string; bookmaker: string; period: string; accounts: number };
  summary: ReportSummary;
  monthly: ReportMonthly[];
  breakdown: { profiles: ReportRow[]; bookmakers: ReportRow[]; accounts: ReportRow[] };
  insights: string[];
  /** Todas as linhas do âmbito, da mais recente para a mais antiga. */
  transactions: ReportTransaction[];
  labels: ReportLabels;
}

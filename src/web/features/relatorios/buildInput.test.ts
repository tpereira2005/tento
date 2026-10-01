import { afterEach, describe, expect, it } from 'vitest';
import { UNKNOWN_ID, type IsoDate, type MonthKey } from '../../../core';
import type { TxnDto } from '../../api/types';
import { setLocale } from '../../i18n';
import { ptReportLabels } from '../../pdf/labels';
import type { DashboardDto } from '../painel/api';
import {
  buildReportInput,
  collectReportInput,
  countScopeWallets,
  insightsToPlainText,
  labelRows,
  mapTransactions,
  reportFilename,
  REPORT_PAGE_SIZE,
} from './buildInput';
import { cleanReportSearch, parseReportSearch, reportQueryParams, resolveReportFilters } from './search';

const MINUS = String.fromCharCode(0x2212);
const NBSP = String.fromCharCode(0xa0);
const TODAY = '2026-09-30' as IsoDate;
const mk = (s: string) => s as MonthKey;

afterEach(() => {
  setLocale('pt-PT');
});

const profiles = [
  { id: 'p-ana', name: 'Ana' },
  { id: 'p-rui', name: 'Rui' },
];
const bookmakers = [
  { id: 'b-a', name: 'Casa A' },
  { id: 'b-b', name: 'Casa B' },
];
const wallets = [
  { id: 'w1', profileId: 'p-ana', profileName: 'Ana', bookmakerId: 'b-a', bookmakerName: 'Casa A' },
  { id: 'w2', profileId: 'p-ana', profileName: 'Ana', bookmakerId: 'b-b', bookmakerName: 'Casa B' },
  { id: 'w3', profileId: 'p-rui', profileName: 'Rui', bookmakerId: 'b-a', bookmakerName: 'Casa A' },
];

const row = (id: string, net: number) => ({
  id,
  depositedCents: 1000,
  withdrawnCents: 1000 + net,
  netCents: net,
  share: 0.5,
});

function dashboard(): DashboardDto {
  return {
    summary: {
      depositedCents: 5000,
      withdrawnCents: 4000,
      netCents: -1000,
      depositCount: 3,
      withdrawalCount: 2,
      withdrawnRatio: 0.8,
      months: 2,
      positiveMonths: 1,
      negativeMonths: 1,
      zeroMonths: 0,
      avgMonthlyNetCents: -500,
      bestMonth: { month: mk('2026-08'), netCents: 500 },
      worstMonth: { month: mk('2026-09'), netCents: -1500 },
      lastDeposit: null,
      daysSinceLastDeposit: null,
    },
    monthly: [
      {
        month: mk('2026-08'),
        depositedCents: 1000,
        withdrawnCents: 1500,
        netCents: 500,
        cumulativeCents: 500,
        depositCount: 1,
        withdrawalCount: 1,
      },
      {
        month: mk('2026-09'),
        depositedCents: 4000,
        withdrawnCents: 2500,
        netCents: -1500,
        cumulativeCents: -1000,
        depositCount: 2,
        withdrawalCount: 1,
      },
    ],
    streaks: {} as DashboardDto['streaks'],
    heatmap: [],
    breakdown: {
      wallet: [row('w1', -600), row('w2', -400), row(UNKNOWN_ID, 0), row('apagada', 0)],
      profile: [row('p-ana', -1000)],
      bookmaker: [row('b-a', -700), row('b-b', -300)],
    },
    insights: [
      { id: 'worst_month', tone: 'negative', priority: 5, params: { month: mk('2026-09'), netCents: -1500 } },
      { id: 'desconhecido', tone: 'neutral', priority: 1, params: {} },
      {
        id: 'withdrawn_ratio',
        tone: 'neutral',
        priority: 2,
        params: { ratio: 0.8, withdrawnCents: 4000, depositedCents: 5000 },
      },
    ],
  };
}

function txn(i: number): TxnDto {
  return {
    id: `t${String(i)}`,
    walletId: 'w1',
    date: '2026-09-01',
    type: i % 2 === 0 ? 'deposit' : 'withdrawal',
    amountCents: 100 + i,
    seq: i,
    source: 'csv',
    note: i === 0 ? 'Nota' : null,
    profileName: 'Ana',
    bookmakerName: 'Casa A',
    importBatchId: null,
  } as unknown as TxnDto;
}

describe('mapeamento puro', () => {
  it('o nome do ficheiro leva a data de hoje', () => {
    expect(reportFilename('2026-09-30')).toBe('tento-relatorio-2026-09-30.pdf');
  });

  it('labelRows troca os ids pelos nomes e trata ids desconhecidos', () => {
    const names = new Map([['p-ana', 'Ana']]);
    const out = labelRows(
      [row('p-ana', -100), row(UNKNOWN_ID, 0), row('apagado', 0)],
      (id) => names.get(id),
      'Desconhecida',
    );
    expect(out.map((r) => r.label)).toEqual(['Ana', 'Desconhecida', 'Desconhecida']);
    expect(out[0]).toEqual({
      label: 'Ana',
      netCents: -100,
      depositedCents: 1000,
      withdrawnCents: 900,
      share: 0.5,
    });
  });

  it('mapTransactions junta perfil e casa na conta e mantém a ordem', () => {
    const out = mapTransactions([txn(0), txn(1)]);
    expect(out[0]).toEqual({
      date: '2026-09-01',
      account: 'Ana · Casa A',
      type: 'deposit',
      amountCents: 100,
      note: 'Nota',
    });
    expect(out[1]?.type).toBe('withdrawal');
    expect(out[1]?.note).toBeNull();
  });

  it('countScopeWallets respeita perfil e casa', () => {
    expect(countScopeWallets(wallets, {})).toBe(3);
    expect(countScopeWallets(wallets, { profileId: 'p-ana' })).toBe(2);
    expect(countScopeWallets(wallets, { bookmakerId: 'b-a' })).toBe(2);
    expect(countScopeWallets(wallets, { profileId: 'p-rui', bookmakerId: 'b-b' })).toBe(0);
  });

  it('os destaques saem em texto simples, traduzidos, sem os desconhecidos', () => {
    const out = insightsToPlainText(dashboard().insights);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(`Setembro foi o pior mês do período: ${MINUS}15,00${NBSP}€.`);
    expect(out[1]).toContain('80');
    expect(out.join('')).not.toContain('<');
  });

  it('buildReportInput mapeia nomes, âmbito e totais', () => {
    const input = buildReportInput({
      filters: { period: '12m', profileId: 'p-ana' },
      dashboard: dashboard(),
      transactions: [txn(0)],
      catalog: { profiles, bookmakers, wallets } as never,
      insights: ['x'],
      today: TODAY,
      labels: ptReportLabels,
    });
    expect(input.generatedOn).toBe('2026-09-30');
    expect(input.scope).toEqual({
      profile: 'Ana',
      bookmaker: 'Todas as casas',
      period: expect.stringContaining('ago 2026') as string,
      accounts: 2,
    });
    expect(input.breakdown.profiles.map((r) => r.label)).toEqual(['Ana']);
    expect(input.breakdown.bookmakers.map((r) => r.label)).toEqual(['Casa A', 'Casa B']);
    expect(input.breakdown.accounts.map((r) => r.label)).toEqual([
      'Ana · Casa A',
      'Ana · Casa B',
      'Conta desconhecida',
      'Conta desconhecida',
    ]);
    expect(input.summary.netCents).toBe(-1000);
    expect(input.summary.bestMonth).toEqual({ month: mk('2026-08'), netCents: 500 });
    expect(input.monthly).toHaveLength(2);
    expect(input.insights).toEqual(['x']);
    expect(input.transactions).toHaveLength(1);
    expect(input.labels).toBe(ptReportLabels);
  });
});

describe('filtros do relatório no URL', () => {
  it('por omissão é o histórico completo, sem datas', () => {
    expect(resolveReportFilters(parseReportSearch({}), TODAY)).toEqual({ period: 'tudo' });
  });

  it('um período rápido dá o intervalo e datas explícitas têm prioridade', () => {
    expect(resolveReportFilters(parseReportSearch({ periodo: '3m' }), TODAY)).toEqual({
      period: '3m',
      from: '2026-07-01',
      to: '2026-09-30',
    });
    const custom = resolveReportFilters(
      parseReportSearch({ periodo: '3m', perfil: 'p-ana', casa: 'todas', de: '2026-01-05', ate: 'lixo' }),
      TODAY,
    );
    expect(custom).toEqual({ period: 'custom', profileId: 'p-ana', from: '2026-01-05' });
    expect(reportQueryParams(custom)).toEqual({
      profileIds: 'p-ana',
      bookmakerIds: undefined,
      from: '2026-01-05',
      to: undefined,
    });
  });

  it('cleanReportSearch tira os valores por omissão', () => {
    expect(cleanReportSearch({ perfil: 'todos', casa: 'b-a', periodo: 'tudo' })).toEqual({ casa: 'b-a' });
    expect(cleanReportSearch({ periodo: '6m', de: '2026-01-01' })).toEqual({ de: '2026-01-01' });
  });
});

describe('collectReportInput', () => {
  it('pagina até nextCursor ser null, sem limite, e reporta o progresso', async () => {
    const pages: Record<string, { items: TxnDto[]; nextCursor: string | null }> = {
      first: { items: Array.from({ length: 200 }, (_, i) => txn(i)), nextCursor: 'c1' },
      c1: { items: Array.from({ length: 200 }, (_, i) => txn(200 + i)), nextCursor: 'c2' },
      c2: { items: Array.from({ length: 37 }, (_, i) => txn(400 + i)), nextCursor: null },
    };
    const calls: { path: string; query: Record<string, unknown> }[] = [];
    const fetchJson = ((path: string, options?: { query?: Record<string, unknown> }) => {
      const query = options?.query ?? {};
      calls.push({ path, query });
      switch (path) {
        case '/stats/dashboard':
          return Promise.resolve(dashboard());
        case '/profiles':
          return Promise.resolve({ items: profiles });
        case '/bookmakers':
          return Promise.resolve({ items: bookmakers });
        case '/wallets':
          return Promise.resolve({ items: wallets });
        case '/transactions': {
          const key = typeof query.cursor === 'string' ? query.cursor : 'first';
          return Promise.resolve({ ...pages[key], total: 437 });
        }
        default:
          return Promise.reject(new Error(path));
      }
    }) as never;
    const progress: number[] = [];

    const input = await collectReportInput(
      { period: 'custom', profileId: 'p-ana', from: '2026-01-01' as IsoDate },
      { fetchJson, onProgress: (n) => progress.push(n), today: TODAY },
    );

    expect(input.transactions).toHaveLength(437);
    expect(input.transactions[436]?.amountCents).toBe(100 + 436);
    expect(progress).toEqual([0, 200, 400, 437]);
    const txnCalls = calls.filter((c) => c.path === '/transactions');
    expect(txnCalls.map((c) => c.query.cursor)).toEqual([undefined, 'c1', 'c2']);
    expect(txnCalls.every((c) => c.query.limit === REPORT_PAGE_SIZE)).toBe(true);
    expect(txnCalls.every((c) => c.query.profileIds === 'p-ana' && c.query.from === '2026-01-01')).toBe(true);
    expect(input.scope.profile).toBe('Ana');
    expect(input.generatedOn).toBe('2026-09-30');
    expect(input.insights).toHaveLength(2);
    expect(input.labels.reportLabel).toBe('Relatório');
  });
});

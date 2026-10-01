import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addMonths,
  breakdown,
  computeStreaks,
  depositHeatmap,
  filterTransactions,
  firstDayOfMonth,
  generateInsights,
  monthOf,
  monthlySeries,
  summarize,
  type IsoDate,
  type Transaction,
  type WalletRef,
} from '../../../core';
import { setLocale } from '../../i18n';
import { ComparePage } from './ComparePage';
import { resolvePair, parseCompareSearch, periodPair, type Entity } from './search';

const TODAY = '2026-09-30' as IsoDate;
const MINUS = String.fromCharCode(0x2212);

const wallets: WalletRef[] = [
  { id: 'w-ana-a', profileId: 'ana', bookmakerId: 'casa-a' },
  { id: 'w-rui-b', profileId: 'rui', bookmakerId: 'casa-b' },
];

const txn = (
  seq: number,
  walletId: string,
  date: string,
  type: 'deposit' | 'withdrawal',
  amountCents: number,
): Transaction => ({ id: `t${String(seq)}`, walletId, date: date as IsoDate, type, amountCents, seq });

/** Ana: −110,00 € nos últimos 12 meses (+10,00 € em ago 2025); Rui: +15,00 € só em ago 2026. */
const txns: Transaction[] = [
  txn(1, 'w-ana-a', '2025-08-15', 'withdrawal', 1000),
  txn(2, 'w-ana-a', '2026-07-05', 'deposit', 10000),
  txn(3, 'w-ana-a', '2026-08-10', 'withdrawal', 4000),
  txn(4, 'w-ana-a', '2026-09-12', 'deposit', 5000),
  txn(5, 'w-rui-b', '2026-08-03', 'deposit', 2000),
  txn(6, 'w-rui-b', '2026-08-20', 'withdrawal', 3500),
];

let profiles: { id: string; name: string }[];
let bookmakers: { id: string; name: string }[];
let withTxns: boolean;
let dashboardFails: number;
let requests: URL[];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function walletDtos() {
  return wallets.map((w) => ({
    id: w.id,
    profileId: w.profileId,
    profileName: profiles.find((p) => p.id === w.profileId)?.name ?? '',
    bookmakerId: w.bookmakerId,
    bookmakerName: bookmakers.find((b) => b.id === w.bookmakerId)?.name ?? '',
    txnCount: withTxns ? txns.filter((x) => x.walletId === w.id).length : 0,
    lastTxnDate: null,
    lastImportAt: null,
  }));
}

/** Resposta de /api/stats/dashboard calculada como a rota do servidor. */
function dashboardFor(url: URL) {
  const list = (key: string) => url.searchParams.get(key)?.split(',');
  const from = url.searchParams.get('from') as IsoDate | null;
  const to = url.searchParams.get('to') as IsoDate | null;
  const filtered = filterTransactions(txns, wallets, {
    ...(list('profileIds') ? { profileIds: list('profileIds') ?? [] } : {}),
    ...(list('bookmakerIds') ? { bookmakerIds: list('bookmakerIds') ?? [] } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const bounds = { ...(from ? { from: monthOf(from) } : {}), ...(to ? { to: monthOf(to) } : {}) };
  const heatTo = to ?? TODAY;
  return {
    summary: summarize(filtered, { today: TODAY, ...bounds }),
    monthly: monthlySeries(filtered, bounds),
    streaks: computeStreaks(filtered, bounds),
    heatmap: depositHeatmap(filtered, {
      from: from ?? firstDayOfMonth(addMonths(monthOf(heatTo), -11)),
      to: heatTo,
    }),
    breakdown: {
      wallet: breakdown(filtered, wallets, 'wallet'),
      profile: breakdown(filtered, wallets, 'profile'),
      bookmaker: breakdown(filtered, wallets, 'bookmaker'),
    },
    insights: generateInsights({ txns: filtered, wallets, today: TODAY, ...bounds }),
  };
}

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  requests.push(url);
  switch (url.pathname) {
    case '/api/wallets':
      return Promise.resolve(json(200, { items: walletDtos() }));
    case '/api/profiles':
      return Promise.resolve(json(200, { items: profiles }));
    case '/api/bookmakers':
      return Promise.resolve(json(200, { items: bookmakers }));
    case '/api/stats/dashboard':
      if (dashboardFails > 0) {
        dashboardFails -= 1;
        return Promise.resolve(json(500, { error: { code: 'boom', message: 'x' } }));
      }
      return Promise.resolve(json(200, dashboardFor(url)));
    default:
      return Promise.resolve(json(404, { error: { code: 'not_found', message: 'x' } }));
  }
}

function renderCompare(at = '/comparar') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const compare = createRoute({
    getParentRoute: () => root,
    path: '/comparar',
    validateSearch: parseCompareSearch,
    component: ComparePage,
  });
  const others = ['/definicoes', '/importar'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: root.addChildren([compare, ...others]),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

const searchOf = (router: ReturnType<typeof renderCompare>['router']) =>
  router.state.location.search as Record<string, string>;
const dashboardRequests = () => requests.filter((u) => u.pathname === '/api/stats/dashboard');

beforeEach(() => {
  requests = [];
  withTxns = true;
  dashboardFails = 0;
  profiles = [
    { id: 'ana', name: 'Ana' },
    { id: 'rui', name: 'Rui' },
    { id: 'eva', name: 'Eva' },
  ];
  bookmakers = [
    { id: 'casa-a', name: 'Casa A' },
    { id: 'casa-b', name: 'Casa B' },
  ];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  // Radix Select precisa disto no jsdom
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setLocale('pt-PT');
});

describe('Comparar: perfis', () => {
  it('por omissão compara os dois perfis com mais movimentos e mostra as diferenças', async () => {
    renderCompare();
    expect(await screen.findByRole('heading', { level: 1, name: 'Comparar' })).toBeInTheDocument();

    const ana = await screen.findByRole('region', { name: 'Ana' });
    const rui = screen.getByRole('region', { name: 'Rui' });
    expect(ana).toHaveTextContent(`${MINUS}110,00 €`);
    expect(within(ana).getByText('Resultado líquido')).toBeInTheDocument();
    expect(rui).toHaveTextContent('+15,00 €');
    expect(within(ana).getByText('Meses positivos')).toBeInTheDocument();
    expect(within(ana).getByText('Média mensal')).toBeInTheDocument();
    expect(within(ana).getByText('Melhor mês')).toBeInTheDocument();
    expect(within(ana).getByText('Pior mês')).toBeInTheDocument();

    expect(screen.getByRole('combobox', { name: 'Lado A' })).toHaveTextContent('Ana');
    expect(screen.getByRole('combobox', { name: 'Lado B' })).toHaveTextContent('Rui');
    expect(screen.getByRole('radio', { name: 'Perfis' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();

    const diff = screen.getByRole('region', { name: 'Diferença' });
    expect(diff).toHaveTextContent(
      `Resultado líquido: Ana ${MINUS}110,00 € · Rui +15,00 € · diferença ${MINUS}125,00 €`,
    );
    const table = within(diff).getByRole('table');
    const net = within(table).getByRole('row', { name: /Resultado líquido/ });
    expect(net).toHaveTextContent(`${MINUS}125,00 €`);
    // percentagem só para depositado e levantado
    const deposited = within(table).getByRole('row', { name: /Depositado/ });
    expect(deposited).toHaveTextContent('+650');
    expect(within(table).getByRole('row', { name: /Meses positivos/ })).toHaveTextContent('1 de 12');

    // uma consulta por lado
    const calls = dashboardRequests();
    expect(calls.map((u) => u.searchParams.get('profileIds')).sort()).toEqual(['ana', 'rui']);
    expect(calls.every((u) => u.searchParams.get('from') === '2025-10-01')).toBe(true);
  });

  it('o mesmo perfil não pode estar nos dois lados: a opção fica desativada e o URL repetido corrige-se', async () => {
    renderCompare('/comparar?modo=perfis&a=ana&b=ana');
    await screen.findByRole('region', { name: 'Ana' });
    expect(screen.getByRole('combobox', { name: 'Lado B' })).not.toHaveTextContent('Ana');

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('combobox', { name: 'Lado A' }));
    const listbox = await screen.findByRole('listbox');
    const taken = within(listbox).getByRole('option', { name: 'Rui' });
    expect(taken).toHaveAttribute('aria-disabled', 'true');
    expect(within(listbox).getByRole('option', { name: 'Eva' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('escolher o lado A atualiza o URL com os dois lados e a consulta', async () => {
    const { router } = renderCompare('/comparar?modo=perfis&a=ana&b=rui');
    await screen.findByRole('region', { name: 'Rui' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('combobox', { name: 'Lado A' }));
    await user.click(await screen.findByRole('option', { name: 'Eva' }));
    await waitFor(() => {
      expect(searchOf(router)).toMatchObject({ modo: 'perfis', a: 'eva', b: 'rui' });
    });
    expect(await screen.findByRole('region', { name: 'Eva' })).toHaveTextContent('Sem movimentos');
  });

  it('o período partilhado vai para o URL e para a consulta', async () => {
    const { router } = renderCompare('/comparar?modo=perfis&a=ana&b=rui');
    await screen.findByRole('region', { name: 'Ana' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('radio', { name: '3M' }));
    await waitFor(() => {
      expect(searchOf(router)).toMatchObject({ periodo: '3m', a: 'ana', b: 'rui' });
    });
    await waitFor(() => {
      expect(dashboardRequests().some((u) => u.searchParams.get('from') === '2026-07-01')).toBe(true);
    });
    expect(screen.getByRole('radio', { name: '3M' })).toBeChecked();
  });

  it('com "tudo", o lado que começa mais tarde fica com meses a zeros na tabela do gráfico', async () => {
    renderCompare('/comparar?modo=perfis&a=ana&b=rui&periodo=tudo');
    const card = await screen.findByRole('region', { name: 'Resultado acumulado' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    const table = within(card).getByRole('table');
    // ago 2025 … set 2026 = 14 meses + cabeçalho
    expect(within(table).getAllByRole('row')).toHaveLength(15);
    const first = within(table).getAllByRole('row')[1];
    expect(first).toHaveTextContent('ago 2025');
    expect(first).toHaveTextContent('+10,00 €');
    expect(first).toHaveTextContent('0,00 €');
    // Rui só tem resultado em agosto de 2026 (+15,00 €) e mantém o acumulado depois
    const last = within(table).getAllByRole('row')[14];
    expect(last).toHaveTextContent('set 2026');
    expect(last).toHaveTextContent('+15,00 €');
    const monthly = screen.getByRole('region', { name: 'Resultado mensal' });
    await user.click(within(monthly).getByRole('button', { name: 'Ver como tabela' }));
    expect(within(within(monthly).getByRole('table')).getAllByRole('row')).toHaveLength(15);
  });

  it('desenha os dois gráficos com descrição acessível e a legenda', async () => {
    renderCompare('/comparar?modo=perfis&a=ana&b=rui');
    const card = await screen.findByRole('region', { name: 'Resultado acumulado' });
    const svg = within(card).getByRole('img');
    expect(svg).toHaveAccessibleName(/Resultado acumulado de Ana e de Rui em 12 meses/);
    expect(within(card).getByText('linha contínua')).toBeInTheDocument();
    expect(within(card).getByText('linha tracejada')).toBeInTheDocument();
    expect(svg.querySelector('[data-part="line-a"]')).not.toHaveAttribute('stroke-dasharray');
    expect(svg.querySelector('[data-part="line-b"]')).toHaveAttribute('stroke-dasharray');
    const monthly = screen.getByRole('region', { name: 'Resultado mensal' });
    expect(within(monthly).getAllByRole('img')).toHaveLength(2);
  });
});

describe('Comparar: modos no URL', () => {
  it('mudar de modo escreve `modo` no URL e limpa os lados', async () => {
    const { router } = renderCompare('/comparar?modo=perfis&a=ana&b=rui&periodo=6m');
    await screen.findByRole('region', { name: 'Ana' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('radio', { name: 'Casas' }));
    await waitFor(() => {
      expect(searchOf(router)).toEqual({ modo: 'casas', periodo: '6m' });
    });
    expect(await screen.findByRole('region', { name: 'Casa A' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Casa B' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lado A' })).toHaveTextContent('Casa A');

    await user.click(screen.getByRole('radio', { name: 'Períodos' }));
    await waitFor(() => {
      expect(searchOf(router).modo).toBe('periodos');
    });
    expect(await screen.findByRole('combobox', { name: 'Comparar com' })).toHaveTextContent(
      'vs período anterior',
    );
    expect(screen.queryByRole('combobox', { name: 'Lado A' })).not.toBeInTheDocument();
  });

  it('modo casas: compara as duas casas', async () => {
    renderCompare('/comparar?modo=casas&a=casa-a&b=casa-b');
    const a = await screen.findByRole('region', { name: 'Casa A' });
    const b = screen.getByRole('region', { name: 'Casa B' });
    expect(a).toHaveTextContent(`${MINUS}110,00 €`);
    expect(b).toHaveTextContent('+15,00 €');
    expect(
      dashboardRequests()
        .map((u) => u.searchParams.get('bookmakerIds'))
        .sort(),
    ).toEqual(['casa-a', 'casa-b']);
  });

  it('modo períodos: dois períodos com os meses alinhados por posição', async () => {
    renderCompare('/comparar?modo=periodos&a=3m&b=ano');
    const a = await screen.findByRole('region', { name: 'jul 2026 – set 2026' });
    const b = screen.getByRole('region', { name: 'jul 2025 – set 2025' });
    expect(a).toHaveTextContent(`${MINUS}95,00 €`);
    expect(b).toHaveTextContent('+10,00 €');
    const calls = dashboardRequests().map(
      (u) => `${u.searchParams.get('from') ?? ''}..${u.searchParams.get('to') ?? ''}`,
    );
    expect(calls.sort()).toEqual(['2025-07-01..2025-09-30', '2026-07-01..2026-09-30']);

    const card = screen.getByRole('region', { name: 'Resultado acumulado' });
    expect(card).toHaveTextContent('alinhados por posição');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    const rows = within(within(card).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('jul 2026 / jul 2025');
    // ago 2026 (A: +55,00 €) contra ago 2025 (B: +10,00 €)
    expect(rows[2]).toHaveTextContent('ago 2026 / ago 2025');
    expect(rows[2]).toHaveTextContent('+55,00 €');
    expect(rows[2]).toHaveTextContent('+10,00 €');
  });

  it('modo períodos por omissão: 12 meses vs os 12 anteriores', async () => {
    renderCompare('/comparar?modo=periodos');
    const a = await screen.findByRole('region', { name: 'out 2025 – set 2026' });
    const b = screen.getByRole('region', { name: 'out 2024 – set 2025' });
    expect(a).toHaveTextContent(`${MINUS}95,00 €`);
    // o lado B tem um levantamento de 10,00 € em ago 2025 (dentro dos 12 meses anteriores)
    expect(b).toHaveTextContent('+10,00 €');
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();
  });

  it('um período sem movimentos mostra "Sem movimentos" nesse lado', async () => {
    renderCompare('/comparar?modo=periodos&a=3m&b=anterior');
    const b = await screen.findByRole('region', { name: 'abr 2026 – jun 2026' });
    expect(within(b).getByText('Sem movimentos')).toBeInTheDocument();
    expect(within(b).queryByText('Depositado')).not.toBeInTheDocument();
    // o gráfico continua, com os meses do lado vazio a zeros
    const card = screen.getByRole('region', { name: 'Resultado acumulado' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    const rows = within(within(card).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('jul 2026 / abr 2026');
  });

  it('mudar o "comparar com" no modo períodos escreve a e b', async () => {
    const { router } = renderCompare('/comparar?modo=periodos');
    await screen.findByRole('region', { name: 'out 2025 – set 2026' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('combobox', { name: 'Comparar com' }));
    await user.click(await screen.findByRole('option', { name: 'vs mesmo período do ano anterior' }));
    await waitFor(() => {
      expect(searchOf(router)).toMatchObject({ modo: 'periodos', a: '12m', b: 'ano' });
    });
    expect(await screen.findByRole('region', { name: 'out 2024 – set 2025' })).toBeInTheDocument();
  });
});

describe('Comparar: casos limite', () => {
  it('com menos de dois perfis, explica e leva às Definições', async () => {
    profiles = [{ id: 'ana', name: 'Ana' }];
    renderCompare('/comparar?modo=perfis');
    expect(await screen.findByRole('heading', { name: 'Faltam perfis para comparar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para Definições' })).toHaveAttribute('href', '/definicoes');
    // os controlos continuam, para mudar de modo
    expect(screen.getByRole('radio', { name: 'Casas' })).toBeInTheDocument();
    expect(dashboardRequests()).toHaveLength(0);
  });

  it('com menos de duas casas, o mesmo no modo casas', async () => {
    bookmakers = [{ id: 'casa-a', name: 'Casa A' }];
    renderCompare('/comparar?modo=casas');
    expect(await screen.findByRole('heading', { name: 'Faltam casas para comparar' })).toBeInTheDocument();
  });

  it('sem modo no URL, passa para casas se só há um perfil', async () => {
    profiles = [{ id: 'ana', name: 'Ana' }];
    renderCompare('/comparar');
    expect(await screen.findByRole('region', { name: 'Casa A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Casas' })).toBeChecked();
  });

  it('sem transações, mostra os primeiros passos', async () => {
    withTxns = false;
    renderCompare();
    expect(await screen.findByText('Bem-vindo ao Tento')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Perfis' })).not.toBeInTheDocument();
  });

  it('um erro da API mostra um alerta e permite tentar de novo', async () => {
    dashboardFails = 2;
    renderCompare('/comparar?modo=perfis&a=ana&b=rui');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar a comparação');
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('region', { name: 'Ana' })).toBeInTheDocument();
  });

  it('ids desconhecidos no URL voltam aos dois mais ativos', async () => {
    renderCompare('/comparar?modo=perfis&a=nao-existe&b=tambem-nao');
    expect(await screen.findByRole('region', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rui' })).toBeInTheDocument();
  });
});

describe('Comparar: lógica de escolha', () => {
  const items: Entity[] = [
    { id: 'x', name: 'Xavier', activity: 1 },
    { id: 'a', name: 'Ana', activity: 9 },
    { id: 'b', name: 'Bia', activity: 9 },
    { id: 'c', name: 'Carlos', activity: 0 },
  ];
  it('resolvePair usa os mais ativos (empate por nome), respeita o URL e nunca repete', () => {
    expect(resolvePair(items, undefined, undefined)).toEqual(['a', 'b']);
    expect(resolvePair(items, 'c', undefined)).toEqual(['c', 'a']);
    expect(resolvePair(items, 'a', 'a')).toEqual(['a', 'b']);
    expect(resolvePair(items, undefined, 'a')).toEqual(['b', 'a']);
    expect(resolvePair(items, 'zz', 'x')).toEqual(['a', 'x']);
    expect(resolvePair(items.slice(0, 1), undefined, undefined)).toBeUndefined();
    expect(resolvePair([], undefined, undefined)).toBeUndefined();
  });
  it('periodPair: anterior com o mesmo número de meses e ano anterior', () => {
    expect(periodPair('12m', 'anterior', TODAY)).toEqual([
      { from: '2025-10-01', to: '2026-09-30' },
      { from: '2024-10-01', to: '2025-09-30' },
    ]);
    expect(periodPair('3m', 'ano', TODAY)[1]).toEqual({ from: '2025-07-01', to: '2025-09-30' });
    // 29 de fevereiro: o fim recua para 28 de fevereiro
    expect(periodPair('3m', 'ano', '2028-02-29' as IsoDate)[1].to).toBe('2027-02-28');
  });
  it('parseCompareSearch ignora valores inválidos', () => {
    expect(parseCompareSearch({ modo: 'xpto', a: '', b: 'rui', periodo: '99m' })).toEqual({ b: 'rui' });
  });
});

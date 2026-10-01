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
  type BreakdownRow,
  type Insight,
  type IsoDate,
} from '../../../core';
import { acceptanceTransactions, acceptanceWallets } from '../../../core/stats/acceptance.test.fixture';
import { setLocale } from '../../i18n';
import { InsightsCard } from './InsightsCard';
import { PainelPage } from './PainelPage';
import { ScoreboardCard } from './ScoreboardCard';
import { parseDashboardSearch, periodRange } from './search';

const TODAY = '2026-09-30' as IsoDate;
const MINUS = String.fromCharCode(0x2212);

const profiles = [
  { id: 'ana', name: 'Ana' },
  { id: 'rui', name: 'Rui' },
];
const bookmakers = [
  { id: 'casa-a', name: 'Casa A' },
  { id: 'casa-b', name: 'Casa B' },
];
const names: Record<string, [string, string]> = {
  'w-ana-a': ['Ana', 'Casa A'],
  'w-ana-b': ['Ana', 'Casa B'],
  'w-rui-a': ['Rui', 'Casa A'],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function walletDtos(withTxns: boolean) {
  const txns = acceptanceTransactions();
  return acceptanceWallets.map((w) => ({
    id: w.id,
    profileId: w.profileId,
    profileName: names[w.id]?.[0] ?? '',
    bookmakerId: w.bookmakerId,
    bookmakerName: names[w.id]?.[1] ?? '',
    txnCount: withTxns ? txns.filter((x) => x.walletId === w.id).length : 0,
    lastTxnDate: null,
    lastImportAt: '2026-09-28T10:00:00.000Z',
  }));
}

/** Resposta de /api/stats/dashboard calculada como a rota do servidor. */
function dashboardFor(url: URL, profileList = acceptanceWallets) {
  const list = (key: string) => url.searchParams.get(key)?.split(',');
  const from = url.searchParams.get('from') as IsoDate | null;
  const to = url.searchParams.get('to') as IsoDate | null;
  const txns = filterTransactions(acceptanceTransactions(), profileList, {
    ...(list('profileIds') ? { profileIds: list('profileIds')! } : {}),
    ...(list('bookmakerIds') ? { bookmakerIds: list('bookmakerIds')! } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const bounds = { ...(from ? { from: monthOf(from) } : {}), ...(to ? { to: monthOf(to) } : {}) };
  const heatTo = to ?? TODAY;
  const heatFrom = from ?? firstDayOfMonth(addMonths(monthOf(heatTo), -11));
  return {
    summary: summarize(txns, { today: TODAY, ...bounds }),
    monthly: monthlySeries(txns, bounds),
    streaks: computeStreaks(txns, bounds),
    heatmap: depositHeatmap(txns, { from: heatFrom, to: heatTo }),
    breakdown: {
      wallet: breakdown(txns, profileList, 'wallet'),
      profile: breakdown(txns, profileList, 'profile'),
      bookmaker: breakdown(txns, profileList, 'bookmaker'),
    },
    insights: generateInsights({ txns, wallets: profileList, today: TODAY, ...bounds }),
  };
}

const recentItems = [
  ['t1', '2026-09-28', 'deposit', 5000, 'Ana', 'Casa A'],
  ['t2', '2026-09-26', 'withdrawal', 12000, 'Ana', 'Casa B'],
  ['t3', '2026-09-24', 'deposit', 2500, 'Rui', 'Casa A'],
].map(([id, date, type, amountCents, profileName, bookmakerName]) => ({
  id,
  walletId: 'w',
  date,
  type,
  amountCents,
  seq: 0,
  source: 'csv',
  note: null,
  profileName,
  bookmakerName,
  importBatchId: null,
}));

let requests: URL[];
let walletsWithTxns: boolean;
let dashboardFails: number;

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  requests.push(url);
  switch (url.pathname) {
    case '/api/wallets':
      return Promise.resolve(json(200, { items: walletDtos(walletsWithTxns) }));
    case '/api/profiles':
      return Promise.resolve(json(200, { items: profiles }));
    case '/api/bookmakers':
      return Promise.resolve(json(200, { items: bookmakers }));
    case '/api/stats/dashboard':
      if (dashboardFails > 0) {
        dashboardFails--;
        return Promise.resolve(json(500, { error: { code: 'boom', message: 'x' } }));
      }
      return Promise.resolve(json(200, dashboardFor(url)));
    case '/api/transactions':
      return Promise.resolve(json(200, { items: recentItems, nextCursor: null, total: 3 }));
    default:
      return Promise.resolve(json(404, { error: { code: 'not_found', message: 'x' } }));
  }
}

function renderPainel(at = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    validateSearch: parseDashboardSearch,
    component: PainelPage,
  });
  const others = ['/importar', '/transacoes', '/definicoes'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: root.addChildren([index, ...others]),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

const dashboardRequests = () => requests.filter((u) => u.pathname === '/api/stats/dashboard');

beforeEach(() => {
  requests = [];
  walletsWithTxns = true;
  dashboardFails = 0;
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

describe('Painel: números do conjunto de aceitação', () => {
  it('mostra o resultado líquido, a frase, os meses positivos e a linha de estatísticas', async () => {
    renderPainel();
    const hero = await screen.findByRole('region', { name: /Resultado líquido/ });

    expect(within(hero).getByText(`${MINUS}664,50 €`)).toBeInTheDocument();
    expect(hero).toHaveTextContent('Levantaste 84,5 % do que depositaste nos últimos 12 meses.');
    expect(hero).toHaveTextContent('4 280,00 €');
    expect(hero).toHaveTextContent('3 615,50 €');
    expect(within(hero).getByText('5')).toBeInTheDocument();
    expect(within(hero).getByText('de 12')).toBeInTheDocument();
    expect(within(hero).getAllByRole('listitem')).toHaveLength(12);
    expect(hero).toHaveTextContent(`Média mensal${MINUS}55,38 €`);
    expect(hero).toHaveTextContent('Melhor mêsmar · +310,00 €');
    expect(hero).toHaveTextContent(`Pior mêsset · ${MINUS}284,50 €`);
    expect(hero).toHaveTextContent('Último depósito28/09/2026 · há 2 dias');
    expect(
      screen.getByText(/Fluxo de caixa de 3 contas em 2 casas · out 2025 . set 2026/),
    ).toBeInTheDocument();
  });

  it('cada mês dos meses positivos tem texto para leitores de ecrã (não só triângulo)', async () => {
    renderPainel();
    const hero = await screen.findByRole('region', { name: /Resultado líquido/ });
    const pips = within(within(hero).getByRole('list', { name: 'Resultado de cada mês' })).getAllByRole(
      'listitem',
    );
    expect(pips[0]).toHaveTextContent(/out 2025: \+120,00 €/);
    expect(pips[11]).toHaveTextContent(new RegExp(`set 2026: ${MINUS}284,50 €`));
  });

  it('mostra gráficos, repartições, destaques e transações recentes', async () => {
    renderPainel();
    await screen.findByRole('region', { name: /Resultado líquido/ });

    expect(await screen.findByRole('region', { name: 'Resultado acumulado' })).toBeInTheDocument();
    expect(screen.getByText('abaixo de zero desde abril')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resultado mensal' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dias com depósito' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ana vs Rui' })).toBeInTheDocument();

    const houses = screen.getByRole('region', { name: 'Por casa' });
    expect(within(houses).getByText('Casa A')).toBeInTheDocument();
    expect(within(houses).getByText('Total')).toBeInTheDocument();

    const accounts = screen.getByRole('region', { name: 'Contas' });
    expect(within(accounts).getAllByText('importado a 28/09/2026').length).toBe(3);

    const insights = screen.getByRole('region', { name: 'Destaques' });
    expect(within(insights).getAllByRole('listitem')).toHaveLength(3);
    expect(insights).toHaveTextContent(`Setembro foi o pior mês do período: ${MINUS}284,50 €.`);

    const recent = await screen.findByRole('region', { name: 'Transações recentes' });
    expect(within(recent).getByRole('link', { name: /Ver todas/ })).toHaveAttribute('href', '/transacoes');
    const rows = within(recent).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent(`${MINUS}50,00 €`);
    expect(rows[2]).toHaveTextContent('+120,00 €');
  });

  it('o botão Exportar PDF está desativado e explica porquê', async () => {
    renderPainel();
    await screen.findByRole('region', { name: /Resultado líquido/ });
    const button = screen.getByRole('button', { name: 'Exportar PDF' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Exportar PDF chega na etapa 7.');
    expect(screen.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute('href', '/importar');
  });

  it('a tabela do gráfico acumulado alterna', async () => {
    const user = userEvent.setup();
    renderPainel();
    const card = await screen.findByRole('region', { name: 'Resultado acumulado' });
    await user.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    expect(within(card).getByRole('table')).toBeInTheDocument();
    expect(within(card).getAllByRole('row')).toHaveLength(13);
  });
});

describe('Painel: filtros e URL', () => {
  it('por omissão pede 12 meses até hoje', async () => {
    renderPainel();
    await screen.findByRole('region', { name: /Resultado líquido/ });
    const [req] = dashboardRequests();
    expect(req?.searchParams.get('from')).toBe('2025-10-01');
    expect(req?.searchParams.get('to')).toBe('2026-09-30');
    expect(req?.searchParams.get('profileIds')).toBeNull();
  });

  it('lê perfil, casa e período do URL', async () => {
    renderPainel('/?perfil=ana&casa=casa-a&periodo=3m');
    await screen.findByRole('region', { name: /Resultado líquido/ });
    const req = dashboardRequests()[0];
    expect(req?.searchParams.get('profileIds')).toBe('ana');
    expect(req?.searchParams.get('bookmakerIds')).toBe('casa-a');
    expect(req?.searchParams.get('from')).toBe('2026-07-01');
    expect(screen.getByRole('radio', { name: '3M' })).toBeChecked();
  });

  it('"tudo" não tem limites de datas', async () => {
    renderPainel('/?periodo=tudo');
    await screen.findByRole('region', { name: /Resultado líquido/ });
    const req = dashboardRequests()[0];
    expect(req?.searchParams.get('from')).toBeNull();
    expect(req?.searchParams.get('to')).toBeNull();
    expect(screen.getByRole('region', { name: /Resultado líquido/ })).toHaveTextContent('em todo o período');
  });

  it('mudar o período atualiza o URL e refaz o pedido; 12M volta ao endereço limpo', async () => {
    const user = userEvent.setup();
    const { router } = renderPainel();
    await screen.findByRole('region', { name: /Resultado líquido/ });

    await user.click(screen.getByRole('radio', { name: '6M' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ periodo: '6m' });
    });
    await waitFor(() => {
      expect(dashboardRequests().some((u) => u.searchParams.get('from') === '2026-04-01')).toBe(true);
    });

    await user.click(screen.getByRole('radio', { name: '12M' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
  });

  it('escolher um perfil e uma casa escreve-os no URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPainel();
    await screen.findByRole('region', { name: /Resultado líquido/ });

    await user.click(screen.getByRole('combobox', { name: 'Perfil' }));
    await user.click(await screen.findByRole('option', { name: 'Rui' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ perfil: 'rui' });
    });

    await user.click(screen.getByRole('combobox', { name: 'Casa' }));
    await user.click(await screen.findByRole('option', { name: 'Casa A' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ perfil: 'rui', casa: 'casa-a' });
    });
    await waitFor(() => {
      expect(
        dashboardRequests().some(
          (u) =>
            u.searchParams.get('profileIds') === 'rui' && u.searchParams.get('bookmakerIds') === 'casa-a',
        ),
      ).toBe(true);
    });
  });

  it('valores inválidos no URL são ignorados', () => {
    expect(parseDashboardSearch({ periodo: '99m', perfil: 3 })).toEqual({});
    expect(periodRange('3m', TODAY)).toEqual({ from: '2026-07-01', to: TODAY });
    expect(periodRange('tudo', TODAY)).toEqual({});
  });
});

describe('Painel: estados', () => {
  it('sem nenhuma transação mostra os primeiros passos com ligações', async () => {
    walletsWithTxns = false;
    renderPainel();
    expect(await screen.findByRole('heading', { name: 'Bem-vindo ao Tento' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para Definições' })).toHaveAttribute('href', '/definicoes');
    expect(screen.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute('href', '/importar');
    expect(dashboardRequests()).toHaveLength(0);
  });

  it('um filtro sem movimentos mostra uma mensagem calma', async () => {
    renderPainel('/?periodo=3m&perfil=rui&casa=casa-b');
    expect(await screen.findByText('Sem movimentos neste período.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Resultado líquido/ })).toBeNull();
    // os filtros continuam acessíveis para o utilizador recuperar
    expect(screen.getByRole('radio', { name: '12M' })).toBeInTheDocument();
  });

  it('mostra o esqueleto enquanto carrega', async () => {
    renderPainel();
    expect(await screen.findByRole('status')).toHaveTextContent('A carregar o painel');
  });

  it('um erro oferece tentar de novo e recupera', async () => {
    const user = userEvent.setup();
    dashboardFails = 1;
    renderPainel();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar o painel');
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('region', { name: /Resultado líquido/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

const insight = (id: string, tone: Insight['tone'], params: Insight['params']): Insight => ({
  id,
  tone,
  priority: 1,
  params,
});

const ALL_INSIGHTS: Insight[] = [
  insight('negative_streak', 'negative', { months: 4, startMonth: '2026-06' }),
  insight('worst_month', 'negative', { month: '2026-09', netCents: -28450 }),
  insight('deposits_change_vs_prev_month', 'negative', {
    month: '2026-09',
    depositedCents: 51500,
    prevDepositedCents: 31500,
    ratio: 0.6349,
  }),
  insight('best_month', 'positive', { month: '2026-03', netCents: 31000 }),
  insight('positive_streak', 'positive', { months: 3, startMonth: '2026-01' }),
  insight('last3_vs_prev3', 'negative', { last3NetCents: -50950, prev3NetCents: -17500 }),
  insight('days_since_last_deposit', 'positive', { days: 45, date: '2026-08-16' }),
  insight('withdrawn_ratio', 'neutral', {
    ratio: 0.8447,
    depositedCents: 428000,
    withdrawnCents: 361550,
  }),
];

describe('Destaques: texto de cada id', () => {
  const renderInsights = () => {
    render(<InsightsCard insights={ALL_INSIGHTS} />);
    const items = screen.getAllByRole('listitem');
    return Object.fromEntries(ALL_INSIGHTS.map((x, i) => [x.id, items[i]?.textContent ?? '']));
  };

  it('pt-PT', () => {
    const text = renderInsights();
    expect(text.negative_streak).toContain('4 meses seguidos com resultado negativo, desde junho.');
    expect(text.worst_month).toContain(`Setembro foi o pior mês do período: ${MINUS}284,50`);
    expect(text.deposits_change_vs_prev_month).toMatch(
      /Depositaste 515,00.€ em setembro, \+63,5.% face a agosto\./,
    );
    expect(text.best_month).toMatch(/Março foi o melhor mês do período: \+310,00.€\./);
    expect(text.positive_streak).toContain('3 meses seguidos com resultado positivo, desde janeiro.');
    expect(text.last3_vs_prev3).toMatch(/Últimos 3 meses: −509,50.€, contra −175,00.€ nos 3 anteriores\./);
    expect(text.days_since_last_deposit).toContain(
      '45 dias sem depositar; o último depósito foi a 16/08/2026.',
    );
    expect(text.withdrawn_ratio).toMatch(
      /Levantaste 84,5.% do que depositaste \(3.615,50.€ de 4.280,00.€\)\./,
    );
  });

  it('en', () => {
    setLocale('en');
    const text = renderInsights();
    expect(text.negative_streak).toContain('4 months in a row with a negative result, since June.');
    expect(text.worst_month).toContain('September was the worst month of the period');
    expect(text.deposits_change_vs_prev_month).toMatch(
      /You deposited 515,00.€ in September, \+63,5.% compared with August\./,
    );
    expect(text.best_month).toContain('March was the best month of the period');
    expect(text.positive_streak).toContain('3 months in a row with a positive result, since January.');
    expect(text.last3_vs_prev3).toContain('Last 3 months:');
    expect(text.days_since_last_deposit).toContain(
      '45 days without depositing; the last deposit was on 16/08/2026.',
    );
    expect(text.withdrawn_ratio).toMatch(/You withdrew 84,5.% of what you deposited/);
  });

  it('o tom aparece em texto e em triângulo, não só em cor; ids desconhecidos não aparecem', () => {
    render(
      <InsightsCard
        insights={[
          insight('worst_month', 'negative', { month: '2026-09', netCents: -100 }),
          insight('best_month', 'positive', { month: '2026-03', netCents: 100 }),
          insight('algo_novo', 'neutral', {}),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^1negativo: /);
    expect(items[1]).toHaveTextContent(/^2positivo: /);
    expect(items[0]?.querySelector('svg')).not.toBeNull();
  });

  it('sem destaques mostra uma frase tranquila', () => {
    render(<InsightsCard insights={[]} />);
    expect(screen.getByText('Ainda não há destaques para este período.')).toBeInTheDocument();
  });
});

describe('Placar de perfis: 1, 2 e 3+ perfis', () => {
  const row = (id: string, netCents: number, share: number): BreakdownRow => ({
    id,
    netCents,
    share,
    depositedCents: 0,
    withdrawnCents: 0,
  });
  const label = (id: string) => ({ ana: 'Ana', rui: 'Rui', eva: 'Eva' })[id] ?? id;
  const count = (id: string) => (id === 'ana' ? 2 : 1);

  it('dois perfis: frente a frente com a partilha do resultado', () => {
    render(
      <ScoreboardCard
        rows={[row('ana', -60750, 0.914), row('rui', -5700, 0.086)]}
        profileName={label}
        accountCount={count}
      />,
    );
    const card = screen.getByRole('region', { name: 'Ana vs Rui' });
    expect(card).toHaveTextContent(`${MINUS}607,50 €`);
    expect(card).toHaveTextContent(`${MINUS}57,00 €`);
    expect(card).toHaveTextContent('2 contas');
    expect(card).toHaveTextContent('1 conta');
    expect(card).toHaveTextContent('91 % do resultado');
    expect(card).toHaveTextContent('9 %');
  });

  it('um perfil: mostra o resultado desse perfil', () => {
    render(<ScoreboardCard rows={[row('ana', 4200, 1)]} profileName={label} accountCount={count} />);
    const card = screen.getByRole('region', { name: 'Ana' });
    expect(card).toHaveTextContent('+42,00 €');
    expect(card).toHaveTextContent('2 contas');
    expect(screen.queryByText(/ vs /)).toBeNull();
  });

  it('três ou mais perfis: lista por ordem de impacto', () => {
    render(
      <ScoreboardCard
        rows={[row('ana', -50000, 0.5), row('eva', 30000, 0.3), row('rui', -20000, 0.2)]}
        profileName={label}
        accountCount={count}
      />,
    );
    const card = screen.getByRole('region', { name: 'Perfis' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(`Ana · 2 contas${MINUS}500,00 €`);
    expect(items[1]).toHaveTextContent('Eva · 1 conta+300,00 €');
    expect(items[2]).toHaveTextContent('50 %'.replace('50', '20'));
  });

  it('sem perfis não desenha nada', () => {
    const { container } = render(<ScoreboardCard rows={[]} profileName={label} accountCount={count} />);
    expect(container).toBeEmptyDOMElement();
  });
});

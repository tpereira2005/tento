import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  breakdown,
  filterTransactions,
  generateInsights,
  monthlySeries,
  summarize,
  type IsoDate,
} from '../../../core';
import { acceptanceTransactions, acceptanceWallets } from '../../../core/stats/acceptance.test.fixture';
import { setLocale } from '../../i18n';
import { buildReportPdf, type ReportInput } from '../../pdf';
import { RelatoriosPage } from './RelatoriosPage';
import { parseReportSearch } from './search';

vi.mock('../../pdf', () => ({ buildReportPdf: vi.fn() }));

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

const walletDtos = () =>
  acceptanceWallets.map((w) => ({
    id: w.id,
    profileId: w.profileId,
    profileName: names[w.id]?.[0] ?? '',
    bookmakerId: w.bookmakerId,
    bookmakerName: names[w.id]?.[1] ?? '',
    txnCount: 5,
    lastTxnDate: null,
    lastImportAt: null,
  }));

function dashboardFor(url: URL) {
  const list = (key: string) => url.searchParams.get(key)?.split(',');
  const from = url.searchParams.get('from') as IsoDate | null;
  const to = url.searchParams.get('to') as IsoDate | null;
  const txns = filterTransactions(acceptanceTransactions(), acceptanceWallets, {
    ...(list('profileIds') ? { profileIds: list('profileIds')! } : {}),
    ...(list('bookmakerIds') ? { bookmakerIds: list('bookmakerIds')! } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const bounds = {};
  return {
    summary: summarize(txns, { today: TODAY, ...bounds }),
    monthly: monthlySeries(txns, bounds),
    breakdown: {
      wallet: breakdown(txns, acceptanceWallets, 'wallet'),
      profile: breakdown(txns, acceptanceWallets, 'profile'),
      bookmaker: breakdown(txns, acceptanceWallets, 'bookmaker'),
    },
    insights: generateInsights({ txns, wallets: acceptanceWallets, today: TODAY, ...bounds }),
  };
}

/** Transações sintéticas: 450 linhas em 3 páginas de 200, 200 e 50. */
const PAGE_SIZES = [200, 200, 50];
function txnPage(index: number) {
  const start = PAGE_SIZES.slice(0, index).reduce((a, b) => a + b, 0);
  const items = Array.from({ length: PAGE_SIZES[index] ?? 0 }, (_, i) => ({
    id: `t${String(start + i)}`,
    walletId: 'w-ana-a',
    date: '2026-09-01',
    type: (start + i) % 2 === 0 ? 'deposit' : 'withdrawal',
    amountCents: 1000 + start + i,
    seq: start + i,
    source: 'csv',
    note: null,
    profileName: 'Ana',
    bookmakerName: 'Casa A',
    importBatchId: null,
  }));
  return { items, nextCursor: index < PAGE_SIZES.length - 1 ? `c${String(index + 1)}` : null, total: 450 };
}

let requests: URL[];
let gates: { transactions?: Promise<void> };

async function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  requests.push(url);
  switch (url.pathname) {
    case '/api/wallets':
      return json(200, { items: walletDtos() });
    case '/api/profiles':
      return json(200, { items: profiles });
    case '/api/bookmakers':
      return json(200, { items: bookmakers });
    case '/api/stats/dashboard':
      return json(200, dashboardFor(url));
    case '/api/transactions': {
      await gates.transactions;
      const cursor = url.searchParams.get('cursor');
      return json(200, txnPage(cursor ? Number(cursor.slice(1)) : 0));
    }
    default:
      return json(404, { error: { code: 'not_found', message: 'x' } });
  }
}

function renderPage(at = '/relatorios') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({
    getParentRoute: () => root,
    path: '/relatorios',
    validateSearch: parseReportSearch,
    component: RelatoriosPage,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

const build = vi.mocked(buildReportPdf);
const downloads: { name: string; href: string }[] = [];
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  requests = [];
  gates = {};
  downloads.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  build.mockReset();
  build.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  revoke = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:tento-teste');
  URL.revokeObjectURL = revoke as unknown as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href });
  });
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLocale('pt-PT');
});

const generateButton = () => screen.getByRole('button', { name: 'Gerar PDF' });

function lastInput(): ReportInput {
  const input = build.mock.calls.at(-1)?.[0];
  if (!input) throw new Error('buildReportPdf não foi chamado');
  return input;
}

describe('página Relatórios', () => {
  it('mostra o título, as 4 páginas e a pré-visualização do âmbito', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    const preview = await screen.findByRole('region', { name: 'Pré-visualização' });
    await waitFor(() => {
      expect(preview).toHaveTextContent(/Relatório de .* · \d+ transações · resultado líquido/);
    });
    expect(preview).toHaveTextContent(`${MINUS}664,50`);
    expect(document.title).toBe('Relatórios · Tento');
  });

  it('o âmbito vem do URL e vai para a pré-visualização', async () => {
    renderPage('/relatorios?perfil=ana&periodo=6m');
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await waitFor(() => {
      expect(requests.some((u) => u.pathname === '/api/stats/dashboard')).toBe(true);
    });
    const req = requests.find((u) => u.pathname === '/api/stats/dashboard');
    expect(req?.searchParams.get('profileIds')).toBe('ana');
    expect(req?.searchParams.get('from')).toBe('2026-04-01');
    expect(req?.searchParams.get('to')).toBe('2026-09-30');
  });

  it('clicar num período atualiza o URL e a pré-visualização', async () => {
    const user = userEvent.setup();
    const { router } = renderPage();
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await user.click(screen.getByRole('radio', { name: '3M' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ periodo: '3m' });
    });
  });

  it('gera o PDF com todas as páginas de transações, nomes e destaques traduzidos', async () => {
    const user = userEvent.setup();
    renderPage('/relatorios?perfil=ana');
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await user.click(generateButton());

    await waitFor(() => {
      expect(build).toHaveBeenCalledTimes(1);
    });
    const input = lastInput();
    const txnRequests = requests.filter((u) => u.pathname === '/api/transactions');
    expect(txnRequests.map((u) => u.searchParams.get('cursor'))).toEqual([null, 'c1', 'c2']);
    expect(txnRequests.every((u) => u.searchParams.get('limit') === '200')).toBe(true);
    expect(txnRequests.every((u) => u.searchParams.get('profileIds') === 'ana')).toBe(true);

    expect(input.transactions).toHaveLength(450);
    expect(input.transactions[0]).toMatchObject({ account: 'Ana · Casa A', type: 'deposit' });
    expect(input.generatedOn).toBe('2026-09-30');
    expect(input.scope.profile).toBe('Ana');
    expect(input.scope.bookmaker).toBe('Todas as casas');
    expect(input.scope.accounts).toBe(2);
    expect(input.labels.reportLabel).toBe('Relatório');
    const profileLabels = input.breakdown.profiles.map((r) => r.label);
    expect(profileLabels).toEqual(['Ana']);
    expect(input.breakdown.bookmakers.map((r) => r.label).sort()).toEqual(['Casa A', 'Casa B']);
    expect(input.breakdown.accounts.every((r) => r.label.startsWith('Ana · Casa'))).toBe(true);
    expect(input.insights.length).toBeGreaterThan(0);
    for (const text of input.insights) {
      expect(text).not.toMatch(/[<>{}]/);
    }
  });

  it('descarrega tento-relatorio-AAAA-MM-DD.pdf e revoga o URL do objeto', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await user.click(generateButton());

    await waitFor(() => {
      expect(downloads).toHaveLength(1);
    });
    expect(downloads[0]?.name).toBe('tento-relatorio-2026-09-30.pdf');
    expect(downloads[0]?.href).toBe('blob:tento-teste');
    await waitFor(
      () => {
        expect(revoke).toHaveBeenCalledWith('blob:tento-teste');
      },
      { timeout: 3000 },
    );
    expect(screen.getByRole('status')).toHaveTextContent('Relatório gerado: tento-relatorio-2026-09-30.pdf.');
  });

  it('mostra o progresso e desativa o botão enquanto corre', async () => {
    const user = userEvent.setup();
    let releaseTxns: () => void = () => undefined;
    gates.transactions = new Promise<void>((resolve) => {
      releaseTxns = resolve;
    });
    let finishPdf: (b: Blob) => void = () => undefined;
    build.mockReturnValue(
      new Promise<Blob>((resolve) => {
        finishPdf = resolve;
      }),
    );
    renderPage();
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await user.click(generateButton());

    expect(generateButton()).toBeDisabled();
    expect(await screen.findByText('A recolher transações… 0')).toBeInTheDocument();

    releaseTxns();
    expect((await screen.findAllByText('A desenhar o PDF…')).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent('A desenhar o PDF…');
    expect(generateButton()).toBeDisabled();
    expect(lastInput().transactions).toHaveLength(450);

    finishPdf(new Blob(['%PDF']));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Relatório gerado: tento-relatorio-2026-09-30.pdf.',
      );
    });
    expect(generateButton()).toBeEnabled();
  });

  it('um erro aparece num alerta e "Tentar novamente" repete a geração', async () => {
    const user = userEvent.setup();
    build.mockRejectedValueOnce(new Error('falhou'));
    renderPage();
    await screen.findByRole('region', { name: 'Pré-visualização' });
    await user.click(generateButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível gerar o relatório.');
    expect(generateButton()).toBeEnabled();
    expect(downloads).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => {
      expect(downloads).toHaveLength(1);
    });
    expect(build).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('um erro da API na recolha também mostra o alerta', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('region', { name: 'Pré-visualização' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(500, { error: { code: 'boom', message: 'x' } }))),
    );
    await user.click(generateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gerar o relatório.');
    expect(build).not.toHaveBeenCalled();
  });
});

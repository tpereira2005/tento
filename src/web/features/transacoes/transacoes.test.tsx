import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCents } from '../../../core';
import { setLocale } from '../../i18n';
import { parseTransactionsSearch } from './search';
import { TransacoesPage } from './TransacoesPage';

// a primeira renderização é lenta quando os projetos de teste correm em paralelo
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20_000 });

/** Texto como o jest-dom o normaliza (o espaço inseparável vira espaço). */
const fmt = (cents: number, options?: Parameters<typeof formatCents>[1]) =>
  formatCents(cents, options).replace(/\s/g, ' ');

interface Row {
  id: string;
  walletId: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  amountCents: number;
  seq: number;
  source: 'csv' | 'manual';
  note: string | null;
  profileName: string;
  bookmakerName: string;
  importBatchId: string | null;
}

const profiles = [
  { id: 'ana', name: 'Ana' },
  { id: 'rui', name: 'Rui' },
];
const bookmakers = [
  { id: 'casa-a', name: 'Casa A' },
  { id: 'casa-b', name: 'Casa B' },
];
const walletDefs = [
  { id: 'w-ana-a', profileId: 'ana', bookmakerId: 'casa-a' },
  { id: 'w-rui-a', profileId: 'rui', bookmakerId: 'casa-a' },
];

function row(partial: Partial<Row> & Pick<Row, 'id' | 'date' | 'type' | 'amountCents'>): Row {
  const walletId = partial.walletId ?? 'w-ana-a';
  return {
    walletId,
    seq: 0,
    source: 'csv',
    note: null,
    profileName: walletId === 'w-ana-a' ? 'Ana' : 'Rui',
    bookmakerName: 'Casa A',
    importBatchId: null,
    ...partial,
  };
}

const small = (): Row[] => [
  row({ id: 'a', date: '2026-09-28', type: 'deposit', amountCents: 5000 }),
  row({ id: 'b', date: '2026-09-20', type: 'withdrawal', amountCents: 12050, note: 'prémio de jogo' }),
  row({
    id: 'c',
    date: '2026-08-02',
    type: 'deposit',
    amountCents: 2500,
    walletId: 'w-rui-a',
    note: 'bónus',
  }),
];

let rows: Row[];
let requests: { method: string; url: URL; body: unknown }[];
let nextError: { status: number; code: string } | null;
let nextId = 1;

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const walletOf = (id: string) => walletDefs.find((w) => w.id === id);

function filtered(url: URL, withTypeAndNote: boolean): Row[] {
  const p = url.searchParams;
  const list = (key: string) => p.get(key)?.split(',');
  const walletIds = list('walletIds');
  const profileIds = list('profileIds');
  const bookmakerIds = list('bookmakerIds');
  return rows
    .filter((r) => !walletIds || walletIds.includes(r.walletId))
    .filter((r) => !profileIds || profileIds.includes(walletOf(r.walletId)?.profileId ?? ''))
    .filter((r) => !bookmakerIds || bookmakerIds.includes(walletOf(r.walletId)?.bookmakerId ?? ''))
    .filter((r) => !p.get('from') || r.date >= (p.get('from') ?? ''))
    .filter((r) => !p.get('to') || r.date <= (p.get('to') ?? ''))
    .filter((r) => !withTypeAndNote || !p.get('type') || r.type === p.get('type'))
    .filter(
      (r) =>
        !withTypeAndNote ||
        !p.get('q') ||
        (r.note ?? '').toLowerCase().includes((p.get('q') ?? '').toLowerCase()),
    )
    .sort((x, y) => (x.date === y.date ? y.id.localeCompare(x.id) : y.date.localeCompare(x.date)));
}

function summaryOf(list: Row[]) {
  const deposited = list.filter((r) => r.type === 'deposit').reduce((n, r) => n + r.amountCents, 0);
  const withdrawn = list.filter((r) => r.type === 'withdrawal').reduce((n, r) => n + r.amountCents, 0);
  return {
    depositedCents: deposited,
    withdrawnCents: withdrawn,
    netCents: withdrawn - deposited,
    depositCount: list.filter((r) => r.type === 'deposit').length,
    withdrawalCount: list.filter((r) => r.type === 'withdrawal').length,
  };
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, 'http://localhost');
  const method = init?.method ?? 'GET';
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  requests.push({ method, url, body });
  const path = url.pathname;

  if (path === '/api/profiles') return Promise.resolve(json(200, { items: profiles }));
  if (path === '/api/bookmakers') return Promise.resolve(json(200, { items: bookmakers }));
  if (path === '/api/wallets') {
    return Promise.resolve(
      json(200, {
        items: walletDefs.map((w) => ({
          ...w,
          profileName: profiles.find((p) => p.id === w.profileId)?.name,
          bookmakerName: 'Casa A',
          txnCount: rows.filter((r) => r.walletId === w.id).length,
          lastTxnDate: null,
          lastImportAt: null,
        })),
      }),
    );
  }
  if (path === '/api/stats/dashboard') {
    return Promise.resolve(json(200, { summary: summaryOf(filtered(url, false)) }));
  }
  if (path === '/api/transactions' && method === 'GET') {
    const list = filtered(url, true);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const start = Number(url.searchParams.get('cursor') ?? 0);
    const end = start + limit;
    return Promise.resolve(
      json(200, {
        items: list.slice(start, end),
        nextCursor: end < list.length ? String(end) : null,
        total: list.length,
      }),
    );
  }
  if (path === '/api/transactions' && method === 'POST') {
    if (nextError) {
      const e = nextError;
      nextError = null;
      return Promise.resolve(json(e.status, { error: { code: e.code, message: 'x' } }));
    }
    const b = body as {
      walletId: string;
      date: string;
      type: Row['type'];
      amountCents: number;
      note?: string;
    };
    const created = row({
      id: `n${String(nextId++)}`,
      walletId: b.walletId,
      date: b.date,
      type: b.type,
      amountCents: b.amountCents,
      source: 'manual',
      note: b.note ?? null,
    });
    rows.push(created);
    return Promise.resolve(json(201, created));
  }
  const one = /^\/api\/transactions\/([^/]+)$/.exec(path);
  if (one) {
    const id = decodeURIComponent(one[1] ?? '');
    if (nextError) {
      const e = nextError;
      nextError = null;
      return Promise.resolve(json(e.status, { error: { code: e.code, message: 'x' } }));
    }
    const current = rows.find((r) => r.id === id);
    if (!current) return Promise.resolve(json(404, { error: { code: 'not_found', message: 'x' } }));
    if (method === 'PATCH') {
      Object.assign(current, body);
      return Promise.resolve(json(200, current));
    }
    rows = rows.filter((r) => r.id !== id);
    return Promise.resolve(json(204, undefined));
  }
  return Promise.resolve(json(404, { error: { code: 'not_found', message: 'x' } }));
}

function renderPage(at = '/transacoes') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({
    getParentRoute: () => root,
    path: '/transacoes',
    validateSearch: parseTransactionsSearch,
    component: TransacoesPage,
  });
  const imp = createRoute({ getParentRoute: () => root, path: '/importar', component: () => null });
  const router = createRouter({
    routeTree: root.addChildren([page, imp]),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

const listRequests = () =>
  requests.filter((r) => r.method === 'GET' && r.url.pathname === '/api/transactions');
const lastList = () => listRequests().at(-1)?.url.searchParams;
const writes = () => requests.filter((r) => r.method !== 'GET');

beforeEach(() => {
  rows = small();
  requests = [];
  nextError = null;
  nextId = 1;
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

async function openTable() {
  return await screen.findByRole('table', { name: /Transações/ });
}

describe('Transações: lista', () => {
  it('mostra a contagem, as somas e as linhas com sinal, origem e nota', async () => {
    renderPage();
    const table = await openTable();
    expect(await screen.findByText('3 transações')).toBeInTheDocument();

    const sums = screen.getByRole('region', { name: 'Somas das transações filtradas' });
    await waitFor(() => {
      expect(sums).toHaveTextContent(`Depositado${fmt(7500)}`);
    });
    expect(sums).toHaveTextContent(`Levantado${fmt(12050)}`);
    expect(sums).toHaveTextContent(`Resultado líquido${fmt(4550, { signed: true })}`);

    const body = within(table).getAllByRole('row').slice(1);
    expect(body).toHaveLength(3);
    expect(body[0]).toHaveTextContent('28/09/2026');
    expect(body[0]).toHaveTextContent('Ana · Casa A');
    expect(body[0]).toHaveTextContent(`Depósito${fmt(5000)}${fmt(-5000)}`);
    expect(body[0]).toHaveTextContent('CSV');
    expect(body[1]).toHaveTextContent('Levantamento');
    expect(body[1]).toHaveTextContent('+120,50');
    expect(body[1]).toHaveTextContent('prémio de jogo');
    expect(
      within(body[0]!).getByRole('button', {
        name: `Editar transação de 28/09/2026, ${formatCents(5000)}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(body[0]!).getByRole('button', {
        name: `Apagar transação de 28/09/2026, ${formatCents(5000)}`,
      }),
    ).toBeInTheDocument();
  });

  it('abaixo de 768 px usa uma lista empilhada', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    renderPage();
    const list = await screen.findByRole('list', { name: 'Transações' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Carregar mais junta a página seguinte e desaparece no fim', async () => {
    rows = Array.from({ length: 120 }, (_, i) =>
      row({
        id: `r${String(i).padStart(3, '0')}`,
        date: `2026-0${String(1 + (i % 9))}-${String(1 + (i % 27)).padStart(2, '0')}`,
        type: i % 2 ? 'deposit' : 'withdrawal',
        amountCents: 100 + i,
      }),
    );
    const user = userEvent.setup();
    renderPage();
    const table = await openTable();
    expect(await screen.findByText('120 transações')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByText('A mostrar 50 de 120')).toBeInTheDocument();
    expect(lastList()?.get('limit')).toBe('50');
    expect(lastList()?.get('cursor')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(101);
    });
    expect(lastList()?.get('cursor')).toBe('50');
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent(
      'Carregadas mais transações: 100 de 120.',
    );

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(121);
    });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
    expect(screen.getByText('A mostrar 120 de 120')).toBeInTheDocument();
  });
});

describe('Transações: filtros no URL', () => {
  it('lê os filtros do URL e envia-os à API (as somas não levam tipo nem nota)', async () => {
    renderPage('/transacoes?tipo=withdrawal&q=pr%C3%A9mio&perfil=ana&periodo=6m');
    await openTable();
    expect(await screen.findByText('1 transação')).toBeInTheDocument();
    const p = lastList();
    expect(p?.get('type')).toBe('withdrawal');
    expect(p?.get('q')).toBe('prémio');
    expect(p?.get('profileIds')).toBe('ana');
    expect(p?.get('from')).toBe('2026-04-01');
    expect(p?.get('to')).toBe('2026-09-30');
    expect(screen.getByRole('searchbox')).toHaveValue('prémio');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Levantamentos');
    expect(screen.getByText(/as somas respeitam/i, { exact: false })).toBeInTheDocument();

    const sums = requests.filter((r) => r.url.pathname === '/api/stats/dashboard');
    expect(sums.length).toBeGreaterThan(0);
    for (const s of sums) {
      expect(s.url.searchParams.get('type')).toBeNull();
      expect(s.url.searchParams.get('q')).toBeNull();
    }
  });

  it('escolher tipo, conta e período escreve-os no URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPage();
    await openTable();

    await user.click(screen.getByRole('combobox', { name: 'Tipo' }));
    await user.click(await screen.findByRole('option', { name: 'Depósitos' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tipo: 'deposit' });
    });
    await waitFor(() => {
      expect(screen.getByText('2 transações')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox', { name: 'Conta' }));
    await user.click(await screen.findByRole('option', { name: 'Rui · Casa A' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tipo: 'deposit', conta: 'w-rui-a' });
    });
    expect(lastList()?.get('walletIds')).toBe('w-rui-a');

    await user.click(screen.getByRole('radio', { name: '3M' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tipo: 'deposit', conta: 'w-rui-a', periodo: '3m' });
    });
    expect(lastList()?.get('from')).toBe('2026-07-01');

    await user.click(screen.getByRole('radio', { name: 'Tudo' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ tipo: 'deposit', conta: 'w-rui-a' });
    });
  });

  it('as datas de e até têm prioridade sobre o período', async () => {
    const { router } = renderPage();
    await openTable();
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-09-01' } });
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ de: '2026-09-01' });
    });
    expect(lastList()?.get('from')).toBe('2026-09-01');
    await waitFor(() => {
      expect(screen.getByText('2 transações')).toBeInTheDocument();
    });
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('a pesquisa só chega ao URL 300 ms depois da última tecla', async () => {
    const user = userEvent.setup();
    const { router } = renderPage();
    await openTable();
    const before = listRequests().length;

    await user.type(screen.getByRole('searchbox'), 'bón');
    expect(router.state.location.search).toEqual({});
    expect(listRequests().length).toBe(before);

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: 'bón' });
    });
    await waitFor(() => {
      expect(lastList()?.get('q')).toBe('bón');
    });
    expect(await screen.findByText('1 transação')).toBeInTheDocument();
  });

  it('sem resultados mostra a mensagem e Limpar filtros repõe tudo', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('/transacoes?q=nada&tipo=deposit');
    expect(await screen.findByText('Nenhuma transação com estes filtros.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    expect(await screen.findByText('3 transações')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

describe('Transações: estados vazios', () => {
  it('sem nenhuma transação aponta para Importar e para Adicionar', async () => {
    rows = [];
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Ainda sem transações')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Importar CSV' })) {
      expect(link).toHaveAttribute('href', '/importar');
    }
    const add = screen.getAllByRole('button', { name: 'Adicionar transação' });
    expect(add.length).toBeGreaterThan(0);
    await user.click(add[add.length - 1]!);
    expect(await screen.findByRole('dialog', { name: 'Adicionar transação' })).toBeInTheDocument();
  });
});

describe('Transações: formulário', () => {
  async function openAdd(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await openTable();
    await user.click(screen.getByRole('button', { name: 'Adicionar transação' }));
    return await screen.findByRole('dialog', { name: 'Adicionar transação' });
  }

  it('mostra o valor percebido e rejeita zero, decimais a mais e texto', async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user).then((d) => within(d));
    const amount = dialog.getByLabelText('Valor');

    await user.type(amount, '1.234,56');
    expect(dialog.getByText(`= ${fmt(123456)}`)).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '25');
    expect(dialog.getByText(`= ${fmt(2500)}`)).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '25,505');
    expect(dialog.getByText('Usa no máximo duas casas decimais.')).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');

    await user.clear(amount);
    await user.type(amount, '0');
    expect(dialog.getByText('O valor tem de ser maior que zero.')).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '-5');
    expect(dialog.getByText('O valor tem de ser maior que zero.')).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, 'abc');
    expect(dialog.getByText('Valor inválido. Escreve, por exemplo, 25,50.')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(writes()).toHaveLength(0);
  });

  it('valida a data e conta os caracteres da nota', async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user).then((d) => within(d));
    expect(dialog.getByLabelText('Data')).toHaveValue('2026-09-30');
    expect(dialog.getByText('0/500')).toBeInTheDocument();

    await user.type(dialog.getByLabelText('Nota (opcional)'), 'olá');
    expect(dialog.getByText('3/500')).toBeInTheDocument();

    await user.type(dialog.getByLabelText('Valor'), '10');
    fireEvent.change(dialog.getByLabelText('Data'), { target: { value: '1899-12-31' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(dialog.getByText('Indica uma data válida (AAAA-MM-DD, a partir de 1900).')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('cria uma transação, fecha o diálogo, anuncia e invalida listas e contas', async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user).then((d) => within(d));
    await user.click(dialog.getByRole('radio', { name: 'Levantamento' }));
    await user.type(dialog.getByLabelText('Valor'), '25,50');
    await user.type(dialog.getByLabelText('Nota (opcional)'), '  teste  ');
    fireEvent.change(dialog.getByLabelText('Data'), { target: { value: '2026-09-29' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(writes()).toHaveLength(1);
    expect(writes()[0]?.method).toBe('POST');
    expect(writes()[0]?.body).toEqual({
      walletId: 'w-ana-a',
      date: '2026-09-29',
      type: 'withdrawal',
      amountCents: 2550,
      note: 'teste',
    });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Transação adicionada.');
    expect(await screen.findByText('4 transações')).toBeInTheDocument();
    const table = await openTable();
    expect(within(table).getAllByText('Manual')).toHaveLength(1);
    // as contas (contagens) e as estatísticas voltaram a ser pedidas
    await waitFor(() => {
      expect(requests.filter((r) => r.url.pathname === '/api/wallets').length).toBeGreaterThan(1);
      expect(requests.filter((r) => r.url.pathname === '/api/stats/dashboard').length).toBeGreaterThan(1);
    });
  });

  it('mostra o erro 422 do servidor no próprio formulário e mantém-no aberto', async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user).then((d) => within(d));
    await user.type(dialog.getByLabelText('Valor'), '10');
    nextError = { status: 422, code: 'invalid' };
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Os dados não foram aceites.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    nextError = { status: 404, code: 'not_found' };
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(dialog.getByRole('alert')).toHaveTextContent('já não existe');
    });
  });

  it('edita só o que mudou e avisa que a linha veio de um CSV', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await openTable();
    await user.click(
      within(table).getByRole('button', { name: `Editar transação de 28/09/2026, ${formatCents(5000)}` }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Editar transação' }));
    expect(
      dialog.getByText(
        'Esta transação veio de um CSV. Se a reimportares com outro valor vai aparecer como conflito.',
      ),
    ).toBeInTheDocument();
    expect(dialog.getByText('Ana · Casa A')).toBeInTheDocument(); // a conta aparece como texto (não editável)
    expect(dialog.getByLabelText('Valor')).toHaveValue('50,00');

    await user.clear(dialog.getByLabelText('Valor'));
    await user.type(dialog.getByLabelText('Valor'), '60,25');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(writes()[0]).toMatchObject({ method: 'PATCH', body: { amountCents: 6025 } });
    expect(Object.keys(writes()[0]?.body as object)).toEqual(['amountCents']);
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Transação atualizada.');
    expect(await within(table).findByText(fmt(6025))).toBeInTheDocument();
  });

  it('uma linha manual não mostra o aviso de CSV e limpar a nota envia null', async () => {
    rows = [
      row({ id: 'm', date: '2026-09-01', type: 'deposit', amountCents: 1000, source: 'manual', note: 'x' }),
    ];
    const user = userEvent.setup();
    renderPage();
    const table = await openTable();
    await user.click(within(table).getByRole('button', { name: /^Editar transação/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Editar transação' }));
    expect(dialog.queryByText(/veio de um CSV/)).not.toBeInTheDocument();
    await user.clear(dialog.getByLabelText('Nota (opcional)'));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(writes()[0]?.body).toEqual({ note: null });
    });
  });

  it('apagar pede confirmação com data, montante e conta', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await openTable();
    await user.click(
      within(table).getByRole('button', { name: `Apagar transação de 20/09/2026, ${formatCents(12050)}` }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Apagar esta transação?' });
    expect(dialog).toHaveTextContent(`Levantamento de ${fmt(12050)} em 20/09/2026, na conta Ana · Casa A.`);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(writes()).toHaveLength(0);

    await user.click(
      within(table).getByRole('button', { name: `Apagar transação de 20/09/2026, ${formatCents(12050)}` }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apagar transação' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(writes()[0]).toMatchObject({ method: 'DELETE' });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Transação apagada.');
    expect(await screen.findByText('2 transações')).toBeInTheDocument();
  });

  it('apagar uma transação que já não existe mostra o erro dentro do diálogo', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = await openTable();
    await user.click(
      within(table).getByRole('button', { name: `Apagar transação de 28/09/2026, ${formatCents(5000)}` }),
    );
    rows = rows.filter((r) => r.id !== 'a');
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apagar transação' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta transação já não existe.');
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefinicoesPage } from './DefinicoesPage';

interface Named {
  id: string;
  name: string;
}
interface Wallet {
  id: string;
  profileId: string;
  profileName: string;
  bookmakerId: string;
  bookmakerName: string;
  txnCount: number;
  lastTxnDate: string | null;
  lastImportAt: string | null;
}

interface Db {
  bookmakers: Named[];
  profiles: Named[];
  wallets: Wallet[];
  theme: string;
}

let db: Db;
let staleWalletList = false;
let calls: { method: string; path: string; body: unknown }[];

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const apiError = (status: number, code: string) => json(status, { error: { code, message: code } });

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/** API falsa em memória: só o necessário para estes fluxos. */
function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = new URL(urlOf(input), 'http://localhost').pathname;
  const method = init?.method ?? 'GET';
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ method, path, body });
  const named = /^\/api\/(bookmakers|profiles)(?:\/([^/]+))?$/.exec(path);
  if (named) {
    const kind = named[1] as 'bookmakers' | 'profiles';
    const id = named[2];
    const list = db[kind];
    const name = (body as { name?: string } | undefined)?.name?.trim() ?? '';
    const clash = list.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== id);
    if (method === 'GET') return Promise.resolve(json(200, { items: list }));
    if (method === 'POST') {
      if (name === '') return Promise.resolve(apiError(422, 'invalid_name'));
      if (clash) return Promise.resolve(apiError(409, 'duplicate'));
      const item = { id: `n${String(list.length + 1)}${name}`, name };
      list.push(item);
      return Promise.resolve(json(201, item));
    }
    const item = list.find((x) => x.id === id);
    if (!item) return Promise.resolve(apiError(404, 'not_found'));
    if (method === 'PATCH') {
      if (clash) return Promise.resolve(apiError(409, 'duplicate'));
      item.name = name;
      return Promise.resolve(json(200, item));
    }
    db[kind] = list.filter((x) => x.id !== id);
    const field = kind === 'bookmakers' ? 'bookmakerId' : 'profileId';
    db.wallets = db.wallets.filter((w) => w[field] !== id);
    return Promise.resolve(json(204, undefined));
  }
  if (path === '/api/wallets') {
    if (method === 'GET') return Promise.resolve(json(200, { items: staleWalletList ? [] : db.wallets }));
    const b = body as { profileId: string; bookmakerId: string };
    const p = db.profiles.find((x) => x.id === b.profileId);
    const k = db.bookmakers.find((x) => x.id === b.bookmakerId);
    if (!p || !k) return Promise.resolve(apiError(404, 'not_found'));
    if (db.wallets.some((w) => w.profileId === p.id && w.bookmakerId === k.id)) {
      return Promise.resolve(apiError(409, 'duplicate'));
    }
    const w: Wallet = {
      id: `w${String(db.wallets.length + 1)}`,
      profileId: p.id,
      profileName: p.name,
      bookmakerId: k.id,
      bookmakerName: k.name,
      txnCount: 0,
      lastTxnDate: null,
      lastImportAt: null,
    };
    db.wallets.push(w);
    return Promise.resolve(json(201, w));
  }
  if (path.startsWith('/api/wallets/') && method === 'DELETE') {
    db.wallets = db.wallets.filter((w) => w.id !== path.split('/').pop());
    return Promise.resolve(json(204, undefined));
  }
  if (path === '/api/me') {
    return Promise.resolve(
      json(200, {
        user: { id: 'u1', name: 'Ana Exemplo', email: 'ana@exemplo.test' },
        settings: { theme: db.theme, locale: 'pt-PT' },
      }),
    );
  }
  if (path === '/api/me/settings' && method === 'PATCH') {
    db.theme = (body as { theme: string }).theme;
    return Promise.resolve(json(200, { theme: db.theme, locale: 'pt-PT' }));
  }
  return Promise.resolve(apiError(404, 'not_found'));
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DefinicoesPage />
    </QueryClientProvider>,
  );
}

const region = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  calls = [];
  staleWalletList = false;
  db = {
    bookmakers: [{ id: 'b1', name: 'Casa A' }],
    profiles: [{ id: 'p1', name: 'Ana' }],
    wallets: [
      {
        id: 'w1',
        profileId: 'p1',
        profileName: 'Ana',
        bookmakerId: 'b1',
        bookmakerName: 'Casa A',
        txnCount: 3,
        lastTxnDate: '2026-03-14',
        lastImportAt: null,
      },
    ],
    theme: 'system',
  };
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Casas', () => {
  it('adiciona uma casa, anuncia e devolve o foco ao campo', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');

    const field = within(casas).getByLabelText('Nome da casa');
    await user.type(field, 'Casa B');
    await user.click(within(casas).getByRole('button', { name: 'Adicionar casa' }));

    expect(await within(casas).findByText('Casa B')).toBeInTheDocument();
    expect(calls).toContainEqual({ method: 'POST', path: '/api/bookmakers', body: { name: 'Casa B' } });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Casa criada');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
  });

  it('mostra o erro 409 quando a casa já existe', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');

    await user.type(within(casas).getByLabelText('Nome da casa'), 'casa a');
    await user.click(within(casas).getByRole('button', { name: 'Adicionar casa' }));

    expect(await within(casas).findByText('Já existe uma casa com este nome.')).toBeInTheDocument();
    expect(within(casas).getByLabelText('Nome da casa')).toHaveAttribute('aria-invalid', 'true');
  });

  it('mostra a regra do nome quando está vazio (sem pedido)', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');
    await user.click(within(casas).getByRole('button', { name: 'Adicionar casa' }));
    expect(within(casas).getByText('O nome deve ter entre 1 e 60 caracteres.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('renomeia com Enter e cancela com Escape', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');

    await user.click(within(casas).getByRole('button', { name: 'Renomear Casa A' }));
    await user.keyboard('{Escape}');
    expect(within(casas).getByText('Casa A')).toBeInTheDocument();
    expect(within(casas).getByRole('button', { name: 'Renomear Casa A' })).toHaveFocus();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await user.click(within(casas).getByRole('button', { name: 'Renomear Casa A' }));
    const input = within(casas).getByRole('textbox', { name: 'Renomear Casa A' });
    await user.clear(input);
    await user.type(input, 'Casa Z{Enter}');
    expect(await within(casas).findByText('Casa Z')).toBeInTheDocument();
    expect(calls).toContainEqual({ method: 'PATCH', path: '/api/bookmakers/b1', body: { name: 'Casa Z' } });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Casa renomeada');
  });

  it('mostra 409 ao renomear para um nome existente', async () => {
    const user = userEvent.setup();
    db.bookmakers.push({ id: 'b2', name: 'Casa B' });
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa B');

    await user.click(within(casas).getByRole('button', { name: 'Renomear Casa B' }));
    const input = within(casas).getByRole('textbox', { name: 'Renomear Casa B' });
    await user.clear(input);
    await user.type(input, 'Casa A{Enter}');
    expect(await within(casas).findByText('Já existe uma casa com este nome.')).toBeInTheDocument();
  });

  it('pede confirmação antes de apagar e atualiza também as contas', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');
    const contas = region('Contas');
    await within(contas).findByText('Ana · Casa A');

    await user.click(within(casas).getByRole('button', { name: 'Apagar Casa A' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apagar Casa A?' });
    expect(
      within(dialog).getByText('Apaga também as contas e as transações desta casa.'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    const walletGets = calls.filter((c) => c.path === '/api/wallets' && c.method === 'GET').length;
    await user.click(within(dialog).getByRole('button', { name: 'Apagar casa' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls).toContainEqual({ method: 'DELETE', path: '/api/bookmakers/b1', body: undefined });
    await waitFor(() => {
      expect(within(casas).getByText('Ainda não tens casas.')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(calls.filter((c) => c.path === '/api/wallets' && c.method === 'GET').length).toBeGreaterThan(
        walletGets,
      );
    });
    expect(within(contas).queryByText('Ana · Casa A')).not.toBeInTheDocument();
    expect(within(casas).getByLabelText('Nome da casa')).toHaveFocus();
  });

  it('cancelar o diálogo não apaga', async () => {
    const user = userEvent.setup();
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    await within(casas).findByText('Casa A');
    await user.click(within(casas).getByRole('button', { name: 'Apagar Casa A' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(within(casas).getByText('Casa A')).toBeInTheDocument();
  });
});

describe('Perfis', () => {
  it('adiciona um perfil e mostra 409 para duplicado', async () => {
    const user = userEvent.setup();
    renderPage();
    const perfis = await screen.findByRole('region', { name: 'Perfis' });
    await within(perfis).findByText('Ana');

    await user.type(within(perfis).getByLabelText('Nome do perfil'), 'Rui');
    await user.click(within(perfis).getByRole('button', { name: 'Adicionar perfil' }));
    expect(await within(perfis).findByText('Rui')).toBeInTheDocument();

    await user.type(within(perfis).getByLabelText('Nome do perfil'), 'ana');
    await user.click(within(perfis).getByRole('button', { name: 'Adicionar perfil' }));
    expect(await within(perfis).findByText('Já existe um perfil com este nome.')).toBeInTheDocument();
  });
});

describe('Contas', () => {
  it('mostra contagem e última data, cria uma conta e apaga com confirmação', async () => {
    const user = userEvent.setup();
    db.bookmakers.push({ id: 'b2', name: 'Casa B' });
    renderPage();
    const contas = await screen.findByRole('region', { name: 'Contas' });
    const row = (await within(contas).findByText('Ana · Casa A')).closest('li');
    expect(row).toHaveTextContent('3 transações');
    expect(row).toHaveTextContent('14/03/2026');
    expect(within(contas).getByText(/Contas de Ana: Casa A/)).toBeInTheDocument();

    // sugere a primeira combinação livre (Ana · Casa B), não uma que já existe
    expect(within(contas).getByRole('button', { name: 'Criar conta' })).toBeEnabled();
    expect(within(contas).queryByText('Esta conta já existe.')).not.toBeInTheDocument();

    await user.click(within(contas).getByRole('button', { name: 'Apagar Ana · Casa A' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apagar a conta Ana · Casa A?' });
    await user.click(within(dialog).getByRole('button', { name: 'Apagar conta' }));
    await waitFor(() => {
      expect(within(contas).queryByText('Ana · Casa A')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(contas).getByRole('button', { name: 'Criar conta' })).toBeEnabled();
    });
    await user.click(within(contas).getByRole('button', { name: 'Criar conta' }));
    expect(await within(contas).findByText('Ana · Casa A')).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/api/wallets',
      body: { profileId: 'p1', bookmakerId: 'b1' },
    });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Conta criada');
  });

  it('avisa e desativa a criação quando todas as combinações já existem', async () => {
    renderPage();
    const contas = await screen.findByRole('region', { name: 'Contas' });
    await within(contas).findByText('Ana · Casa A');
    expect(within(contas).getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    expect(within(contas).getByText('Esta conta já existe.')).toBeInTheDocument();
  });

  it('mostra 409 quando o servidor recusa uma conta repetida', async () => {
    const user = userEvent.setup();
    staleWalletList = true; // outra sessão criou a conta: esta lista local ainda não a conhece
    renderPage();
    const contas = await screen.findByRole('region', { name: 'Contas' });
    const button = await within(contas).findByRole('button', { name: 'Criar conta' });
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    await user.click(button);
    expect(await within(contas).findByRole('alert')).toHaveTextContent('Esta conta já existe.');
  });

  it('desativa a criação e explica quando não há perfis nem casas', async () => {
    db.bookmakers = [];
    db.profiles = [];
    db.wallets = [];
    renderPage();
    const contas = await screen.findByRole('region', { name: 'Contas' });
    const button = await within(contas).findByRole('button', { name: 'Criar conta' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/pelo menos um perfil e uma casa/);
    expect(within(contas).getByText('Ainda não tens contas.')).toBeInTheDocument();
    expect(within(contas).queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('Conta do utilizador', () => {
  it('mostra nome e email e guarda o tema escolhido', async () => {
    const user = userEvent.setup();
    renderPage();
    const conta = await screen.findByRole('region', { name: 'Conta do utilizador' });
    expect(await within(conta).findByText('Ana Exemplo')).toBeInTheDocument();
    expect(within(conta).getByText('ana@exemplo.test')).toBeInTheDocument();
    expect(within(conta).getByText(/nunca são partilhados/)).toBeInTheDocument();

    await user.click(within(conta).getByRole('radio', { name: 'Escuro' }));
    await waitFor(() => {
      expect(calls).toContainEqual({ method: 'PATCH', path: '/api/me/settings', body: { theme: 'dark' } });
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Tema guardado');
    });
    expect(within(conta).getByRole('radio', { name: 'Escuro' })).toBeChecked();
  });
});

describe('Estados', () => {
  it('mostra erro com nova tentativa quando a lista falha', async () => {
    const user = userEvent.setup();
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        fail && urlOf(input).endsWith('/api/bookmakers')
          ? Promise.resolve(apiError(500, 'server_error'))
          : fakeFetch(input, init),
      ),
    );
    renderPage();
    const casas = await screen.findByRole('region', { name: 'Casas' });
    expect(await within(casas).findByText('Não foi possível carregar esta secção.')).toBeInTheDocument();
    fail = false;
    await user.click(within(casas).getByRole('button', { name: 'Tentar novamente' }));
    expect(await within(casas).findByText('Casa A')).toBeInTheDocument();
  });
});

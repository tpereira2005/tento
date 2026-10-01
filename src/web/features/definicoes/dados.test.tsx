import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefinicoesPage } from './DefinicoesPage';

interface Call {
  method: string;
  path: string;
  body: unknown;
}

let calls: Call[];
let accountPasswordOk: boolean;
let dataDeleted: boolean;
let assign: ReturnType<typeof vi.fn>;
let created: Blob[];
let clicked: { download: string; href: string }[];

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/** API falsa: só o necessário para a secção "Os teus dados". */
function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = new URL(urlOf(input), 'http://localhost').pathname;
  const method = init?.method ?? 'GET';
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ method, path, body });
  if (path === '/api/me/export') {
    return Promise.resolve(
      json(
        200,
        { format: 'tento-export', version: 1 },
        { 'content-disposition': 'attachment; filename="tento-dados-2026-06-15.json"' },
      ),
    );
  }
  if (path === '/api/me/data' && method === 'DELETE') {
    const confirm = (body as { confirm?: string } | undefined)?.confirm;
    if (confirm !== 'APAGAR') return Promise.resolve(json(422, { error: { code: 'validation_error' } }));
    dataDeleted = true;
    return Promise.resolve(json(204, undefined));
  }
  if (path === '/api/me' && method === 'DELETE') {
    if (!accountPasswordOk) return Promise.resolve(json(403, { error: { code: 'invalid_password' } }));
    return Promise.resolve(json(204, undefined));
  }
  if (path === '/api/me') {
    return Promise.resolve(
      json(200, {
        user: { id: 'u1', name: 'Ana Exemplo', email: 'ana@exemplo.test' },
        settings: { theme: 'system', locale: 'pt-PT' },
      }),
    );
  }
  return Promise.resolve(json(200, { items: [] }));
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DefinicoesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  calls = [];
  accountPasswordOk = true;
  dataDeleted = false;
  created = [];
  clicked = [];
  assign = vi.fn();
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.stubGlobal('location', { origin: 'http://localhost', assign });
  URL.createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return 'blob:tento-teste';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const dados = () => screen.findByRole('region', { name: 'Os teus dados' });

describe('Os teus dados', () => {
  it('exporta os dados e descarrega o ficheiro com o nome do servidor', async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await dados();
    await user.click(within(region).getByRole('button', { name: 'Exportar dados (JSON)' }));

    await waitFor(() => {
      expect(clicked).toEqual([{ download: 'tento-dados-2026-06-15.json', href: 'blob:tento-teste' }]);
    });
    expect(calls).toContainEqual({ method: 'GET', path: '/api/me/export', body: undefined });
    expect(created).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Exportação descarregada');
    });
  });

  it('mostra erro quando a exportação falha', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        urlOf(input).endsWith('/api/me/export')
          ? Promise.resolve(json(500, { error: { code: 'internal_error' } }))
          : fakeFetch(input, init),
      ),
    );
    renderPage();
    const region = await dados();
    await user.click(within(region).getByRole('button', { name: 'Exportar dados (JSON)' }));
    expect(await within(region).findByRole('alert')).toHaveTextContent('Não foi possível exportar');
    expect(clicked).toEqual([]);
  });

  it('só apaga todos os dados depois de escrever APAGAR', async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await dados();
    await user.click(within(region).getByRole('button', { name: 'Apagar todos os dados' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apagar todos os dados?' });
    const confirm = within(dialog).getByRole('button', { name: 'Apagar tudo' });
    expect(confirm).toBeDisabled();

    const field = within(dialog).getByLabelText('Escreve APAGAR para confirmar');
    await user.type(field, 'apagar');
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, 'APAGAR');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(dataDeleted).toBe(true);
    expect(calls).toContainEqual({ method: 'DELETE', path: '/api/me/data', body: { confirm: 'APAGAR' } });
    expect(screen.getByRole('status', { name: 'Avisos' })).toHaveTextContent('Todos os dados foram apagados');
    // as caches foram invalidadas: o utilizador é pedido outra vez
    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/me').length).toBeGreaterThan(1);
    });
  });

  it('cancelar não apaga nada', async () => {
    const user = userEvent.setup();
    renderPage();
    const region = await dados();
    await user.click(within(region).getByRole('button', { name: 'Apagar todos os dados' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('apagar a conta pede a palavra-passe, mostra o erro e depois vai para a entrada', async () => {
    const user = userEvent.setup();
    accountPasswordOk = false;
    renderPage();
    const region = await dados();
    await user.click(within(region).getByRole('button', { name: 'Apagar conta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Apagar a tua conta?' });

    await user.click(within(dialog).getByRole('button', { name: 'Apagar a minha conta' }));
    expect(await within(dialog).findByText('Indica a tua palavra-passe.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.type(within(dialog).getByLabelText('A tua palavra-passe'), 'errada-errada-1');
    await user.click(within(dialog).getByRole('button', { name: 'Apagar a minha conta' }));
    expect(await within(dialog).findByText('Palavra-passe incorreta.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    accountPasswordOk = true;
    await user.click(within(dialog).getByRole('button', { name: 'Apagar a minha conta' }));
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('/entrar');
    });
    expect(calls).toContainEqual({
      method: 'DELETE',
      path: '/api/me',
      body: { password: 'errada-errada-1' },
    });
  });
});

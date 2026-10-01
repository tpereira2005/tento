import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportHistory } from '.';

interface Batch {
  id: string;
  walletId: string;
  profileName: string;
  bookmakerName: string;
  filename: string;
  rowsTotal: number;
  rowsAdded: number;
  rowsDuplicate: number;
  rowsInvalid: number;
  rowsConflict: number;
  createdAt: string;
  undoneAt: string | null;
}

const batch = (n: number, patch: Partial<Batch> = {}): Batch => ({
  id: `i${String(n)}`,
  walletId: 'w1',
  profileName: 'Ana',
  bookmakerName: 'Casa A',
  filename: `ana-casa-a-${String(n)}.csv`,
  rowsTotal: 12,
  rowsAdded: 5,
  rowsDuplicate: 4,
  rowsInvalid: 2,
  rowsConflict: 1,
  createdAt: '2026-03-14T10:30:00.000Z',
  undoneAt: null,
  ...patch,
});

let items: Batch[];
let calls: { method: string; path: string }[];
let undoResponse: (id: string) => Response;
let listFails: boolean;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const apiError = (status: number, code: string) => json(status, { error: { code, message: code } });

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(raw, 'http://localhost').pathname;
  const method = init?.method ?? 'GET';
  calls.push({ method, path });
  if (path === '/api/imports' && method === 'GET') {
    return Promise.resolve(listFails ? apiError(500, 'boom') : json(200, { items }));
  }
  const undo = /^\/api\/imports\/([^/]+)\/undo$/.exec(path);
  if (undo && method === 'POST') return Promise.resolve(undoResponse(undo[1] ?? ''));
  return Promise.resolve(apiError(404, 'not_found'));
}

function renderHistory(props: { headingId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <ImportHistory {...props} />
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

/** Desfaz de verdade na API falsa: apaga as linhas e marca o import como desfeito. */
function realUndo(id: string): Response {
  const found = items.find((b) => b.id === id);
  if (!found) return apiError(404, 'not_found');
  if (found.undoneAt) return apiError(409, 'already_undone');
  found.undoneAt = '2026-03-15T09:00:00.000Z';
  return json(200, found);
}

beforeEach(() => {
  items = [
    batch(2),
    batch(1, { profileName: 'Rui', bookmakerName: 'Casa B', undoneAt: '2026-03-15T09:00:00.000Z' }),
  ];
  calls = [];
  listFails = false;
  undoResponse = realUndo;
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const undoCalls = () => calls.filter((c) => c.method === 'POST');

describe('ImportHistory', () => {
  it('lista importações ativas e desfeitas, com contagens e estado', async () => {
    renderHistory();
    const list = await screen.findByRole('list', { name: 'Importações' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    const active = rows[0]!;
    expect(active).toHaveTextContent('Ana · Casa A');
    expect(active).toHaveTextContent('ana-casa-a-2.csv');
    expect(active).toHaveTextContent('14/03/2026');
    expect(active).toHaveTextContent('Ativa');
    for (const [label, value] of [
      ['Adicionadas', '5'],
      ['Já importadas', '4'],
      ['Conflitos', '1'],
      ['Com erros', '2'],
    ] as const) {
      const term = within(active).getByText(label);
      expect(term.nextElementSibling).toHaveTextContent(new RegExp(`^${value}$`));
    }
    expect(
      within(active).getByRole('button', { name: 'Desfazer a importação de ana-casa-a-2.csv' }),
    ).toBeVisible();

    const undone = rows[1]!;
    expect(undone).toHaveTextContent('Rui · Casa B');
    expect(undone).toHaveTextContent('Desfeito em 15/03/2026');
    expect(within(undone).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Histórico de importações' })).toBeInTheDocument();
  });

  it('não oferece desfazer quando o import não adicionou nada', async () => {
    items = [batch(1, { rowsAdded: 0 })];
    renderHistory();
    await screen.findByRole('list', { name: 'Importações' });
    expect(screen.queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
    expect(screen.getByText('Nada foi adicionado')).toBeInTheDocument();
  });

  it('usa o headingId recebido no título', async () => {
    renderHistory({ headingId: 'historico-x' });
    const heading = await screen.findByRole('heading', { name: 'Histórico de importações' });
    expect(heading).toHaveAttribute('id', 'historico-x');
  });

  it('confirma, desfaz, invalida as consultas, anuncia e põe o foco na linha', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderHistory();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer a importação de ana-casa-a-2.csv' }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Desfazer esta importação?' });
    expect(dialog).toHaveTextContent(
      'Remove as 5 transações que este import adicionou à conta Ana · Casa A. As outras transações não mudam.',
    );
    expect(undoCalls()).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Desfazer importação' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(undoCalls()).toEqual([{ method: 'POST', path: '/api/imports/i2/undo' }]);
    expect(screen.getByRole('status', { name: 'Avisos do histórico' })).toHaveTextContent(
      'Importação desfeita.',
    );
    await waitFor(() => {
      expect(screen.getAllByText(/Desfeito em/)).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: /Desfazer a importação/ })).not.toBeInTheDocument();
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([['imports'], ['wallets'], ['stats']]));
    expect(screen.getAllByRole('listitem')[0]).toHaveFocus();
  });

  it('diz "1 transação" no singular', async () => {
    items = [batch(1, { rowsAdded: 1 })];
    const user = userEvent.setup();
    renderHistory();
    await user.click(await screen.findByRole('button', { name: /Desfazer a importação/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Remove a 1 transação que este import adicionou à conta Ana · Casa A.',
    );
  });

  it('cancelar não faz nada e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    renderHistory();
    const trigger = await screen.findByRole('button', { name: /Desfazer a importação de ana-casa-a-2/ });
    await user.click(trigger);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(undoCalls()).toHaveLength(0);
    expect(screen.queryByText('Importação desfeita.')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('409 already_undone: informa, fecha o diálogo e atualiza a lista', async () => {
    const user = userEvent.setup();
    undoResponse = () => {
      // alguém desfez entretanto: a lista passa a ter o import desfeito
      const found = items.find((b) => b.id === 'i2');
      if (found) found.undoneAt = '2026-03-15T09:00:00.000Z';
      return apiError(409, 'already_undone');
    };
    renderHistory();
    await user.click(await screen.findByRole('button', { name: /Desfazer a importação de ana-casa-a-2/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desfazer importação' }),
    );

    expect(
      await screen.findByText('Esta importação já tinha sido desfeita. Atualizámos o histórico.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/Desfeito em/)).toHaveLength(2);
    });
  });

  it('outros erros ficam no diálogo, com role=alert, e deixam tentar de novo', async () => {
    const user = userEvent.setup();
    undoResponse = () => apiError(500, 'boom');
    renderHistory();
    await user.click(await screen.findByRole('button', { name: /Desfazer a importação de ana-casa-a-2/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desfazer importação' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível desfazer a importação. Tenta novamente.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Desfazer importação' })).toBeEnabled();
  });

  it('mostra o estado vazio', async () => {
    items = [];
    renderHistory();
    expect(await screen.findByText('Ainda não importaste nenhum ficheiro.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('mostra o erro ao carregar e volta a tentar', async () => {
    const user = userEvent.setup();
    listFails = true;
    renderHistory();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar o histórico.');

    listFails = false;
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('list', { name: 'Importações' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra um esqueleto enquanto carrega', () => {
    renderHistory();
    expect(screen.getByRole('region', { name: 'Histórico de importações' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('mostra no máximo 20 e "Mostrar mais" revela o resto', async () => {
    const user = userEvent.setup();
    items = Array.from({ length: 25 }, (_, i) => batch(i + 1));
    renderHistory();
    const list = await screen.findByRole('list', { name: 'Importações' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('A mostrar 20 de 25')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(25);
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).not.toBeInTheDocument();
  });
});

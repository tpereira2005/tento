import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

/** Resposta JSON para os mocks de `fetch`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function urlOf(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : String(input);
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Substitui `fetch` por um mock que responde conforme o caminho (ex.: `/api/setup`). */
export function mockFetch(handlers: Record<string, Handler | Response>) {
  const fn = vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(urlOf(input), 'http://localhost:3000');
    const handler = handlers[url.pathname];
    if (!handler) return Promise.resolve(jsonResponse({ error: { code: 'not_found', message: 'x' } }, 404));
    return Promise.resolve(typeof handler === 'function' ? handler(url, init) : handler.clone());
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/**
 * Desenha `ui` dentro de um router em memória (para `Link`, `aria-current`…) e de um QueryClient novo.
 * Cada caminho de `paths` existe como rota vazia; `ui` fica na raiz e vê-se em todas.
 */
export function renderWithRouter(ui: ReactNode, options: { at?: string; paths?: string[] } = {}) {
  const {
    at = '/',
    paths = ['/', '/entrar', '/transacoes', '/importar', '/comparar', '/relatorios', '/definicoes'],
  } = options;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const routeTree = root.addChildren(
    paths.map((path) => createRoute({ getParentRoute: () => root, path, component: () => null })),
  );
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [at] }) });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}

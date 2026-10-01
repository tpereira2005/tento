import { createAuthClient } from 'better-auth/react';

/**
 * Cliente do Better Auth (mesma origem; a API está em `/api/auth`).
 * O `fetch` é lido no momento do pedido (e não ao importar o módulo), o que permite substituí-lo nos testes.
 */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  fetchOptions: { customFetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args) },
});

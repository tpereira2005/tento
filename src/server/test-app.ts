import { fileURLToPath } from 'node:url';
import type { BetterAuthRateLimitOptions } from 'better-auth';
import { createApp } from './app';
import { createAuth, type RegistrationMode } from './auth';
import { createLibsqlDb, migrateLibsql } from './db/client';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
export const TEST_ORIGIN = 'http://localhost:5173';
// Segredo aleatório gerado em cada execução dos testes (nada fixo no repositório).
const TEST_SECRET = `${crypto.randomUUID()}${crypto.randomUUID()}`;
export const TEST_PASSWORD = 'palavra-passe-de-teste-1';

/** Cliente HTTP de teste: guarda o cookie de sessão e envia sempre a origem da aplicação. */
export interface TestClient {
  userId: string;
  cookie: string;
  req: (method: string, path: string, body?: unknown, init?: RequestInit) => Promise<Response>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- tipa o corpo da resposta no teste
  json: <T = unknown>(method: string, path: string, body?: unknown) => Promise<{ status: number; body: T }>;
}

/** Aplicação completa sobre uma base `:memory:` nova, com migrações. */
export async function createTestApp(
  registration: RegistrationMode = 'first-user-only',
  rateLimit: BetterAuthRateLimitOptions = { enabled: false },
) {
  const { db, client } = await createLibsqlDb(':memory:');
  await migrateLibsql(db, MIGRATIONS);
  const auth = createAuth({ db, secret: TEST_SECRET, baseURL: TEST_ORIGIN, registration, rateLimit });
  const clock = { now: new Date('2026-06-15T12:00:00Z') };
  const app = createApp({ db, auth, now: () => clock.now });

  const raw = async (method: string, path: string, body?: unknown, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('origin')) headers.set('origin', TEST_ORIGIN);
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers.set('content-type', 'application/json');
    }
    return await app.request(path, {
      ...init,
      method,
      headers,
      ...(payload !== undefined ? { body: payload } : {}),
    });
  };

  const makeClient = (userId: string, cookie: string): TestClient => {
    const req: TestClient['req'] = (method, path, body, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('cookie', cookie);
      return raw(method, path, body, { ...init, headers });
    };
    return {
      userId,
      cookie,
      req,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- tipa o corpo da resposta no teste
      json: async <T>(method: string, path: string, body?: unknown) => {
        const res = await req(method, path, body);
        const text = await res.text();
        return { status: res.status, body: (text === '' ? null : JSON.parse(text)) as T };
      },
    };
  };

  /** Regista um utilizador pelos endpoints reais e devolve o cliente com a sessão. */
  const signUp = async (email: string, name = 'Utilizador de teste'): Promise<TestClient> => {
    const res = await raw('POST', '/api/auth/sign-up/email', { email, name, password: TEST_PASSWORD });
    if (res.status !== 200) throw new Error(`sign-up falhou (${res.status}): ${await res.text()}`);
    const { user } = (await res.json()) as { user: { id: string } };
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    return makeClient(user.id, cookie);
  };

  return { app, auth, db, dbClient: client, clock, raw, signUp, makeClient };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** Cria casa, perfil e conta (Ana · Casa A) para um cliente de teste. */
export async function createCatalog(client: TestClient, profile = 'Ana', bookmaker = 'Casa A') {
  const b = await client.json<{ id: string }>('POST', '/api/bookmakers', { name: bookmaker });
  const p = await client.json<{ id: string }>('POST', '/api/profiles', { name: profile });
  const w = await client.json<{ id: string }>('POST', '/api/wallets', {
    profileId: p.body.id,
    bookmakerId: b.body.id,
  });
  return { bookmakerId: b.body.id, profileId: p.body.id, walletId: w.body.id };
}

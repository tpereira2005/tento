import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import type { TentoAuth } from './auth';
import type { Db } from './db/client';
import { countUsers, InvalidCursorError } from './db/repos';
import { apiError, notFound, type AppEnv } from './http';
import { catalogRoutes } from './routes/catalog';
import { importRoutes } from './routes/imports';
import { meRoutes } from './routes/me';
import { statsRoutes } from './routes/stats';
import { transactionRoutes } from './routes/transactions';
import { isHttps, securityHeadersMiddleware } from './security';

export interface AppDeps {
  db: Db;
  auth: TentoAuth;
  now?: () => Date;
}

const IMPORT_LIMIT = 5 * 1024 * 1024;
const DEFAULT_LIMIT = 64 * 1024;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** API do Tento (montada em `/api`). */
export function createApp({ db, auth, now = () => new Date() }: AppDeps) {
  const origin = new URL(auth.tento.baseURL).origin;
  const api = new Hono<AppEnv>().basePath('/api');

  api.use('*', securityHeadersMiddleware({ https: isHttps(auth.tento.baseURL) }));

  const tooLarge = () => apiError(413, 'payload_too_large', 'O pedido é demasiado grande.');
  const importLimit = bodyLimit({ maxSize: IMPORT_LIMIT, onError: tooLarge });
  const defaultLimit = bodyLimit({ maxSize: DEFAULT_LIMIT, onError: tooLarge });
  api.use('*', (c, next) => {
    const limit = c.req.path.startsWith('/api/imports') ? importLimit : defaultLimit;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- o Hono tipa a entrada do contexto como any
    return limit(c, next);
  });

  // Proteção CSRF: pedidos que alteram estado têm de vir da origem da aplicação.
  api.use('*', async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && c.req.header('origin') !== origin) {
      return apiError(403, 'forbidden', 'Origem não permitida.');
    }
    await next();
  });

  api.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));

  api.get('/setup', async (c) =>
    c.json({ registrationOpen: auth.tento.registration === 'open' || (await countUsers(db)) === 0 }),
  );

  api.use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return apiError(401, 'unauthenticated', 'Sessão em falta ou expirada.');
    const { id, name, email } = session.user;
    c.set('db', db);
    c.set('user', { id, name, email });
    await next();
  });

  api.route('/me', meRoutes(auth, now));
  api.route('/', catalogRoutes());
  api.route('/transactions', transactionRoutes());
  api.route('/imports', importRoutes());
  api.route('/stats', statsRoutes(now));

  api.notFound(() => notFound());
  api.onError((err) => {
    if (err instanceof InvalidCursorError) return apiError(400, 'invalid_cursor', err.message);
    if (err instanceof HTTPException && err.status === 400) {
      return apiError(400, 'bad_request', 'Pedido inválido.');
    }
    console.error(err);
    return apiError(500, 'internal_error', 'Erro interno.');
  });

  return api;
}

export type App = ReturnType<typeof createApp>;

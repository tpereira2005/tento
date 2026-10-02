import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { createApp } from '../app';
import { createAuth } from '../auth';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { loadEnv } from '../env';
import { apiError } from '../http';

/** Ligação D1 tal como o runtime a entrega (o tipo vem do driver do Drizzle, sem os tipos globais do Workers). */
type D1Binding = Parameters<typeof drizzle>[0];

/** Ficheiros estáticos de `dist/` (Workers Static Assets). */
interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

/** Ligações e variáveis definidas em `wrangler.jsonc` (segredos com `wrangler secret put` ou `.dev.vars`). */
export interface WorkerEnv {
  DB: D1Binding;
  ASSETS: AssetsBinding;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  OWNER_EMAIL?: string;
}

let cached: { env: WorkerEnv; server: Hono } | undefined;

/**
 * Monta a aplicação uma vez por isolate. As migrações não correm aqui: no D1 aplicam-se antes do deploy
 * com `wrangler d1 migrations apply` (ver docs/MIGRACAO.md).
 */
function serverFor(env: WorkerEnv): Hono {
  if (cached?.env === env) return cached.server;
  const config = loadEnv({
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    OWNER_EMAIL: env.OWNER_EMAIL,
    NODE_ENV: 'production',
  });
  const db: Db = drizzle(env.DB, { schema });
  const auth = createAuth({
    db,
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    registration: 'first-user-only',
    ownerEmail: config.OWNER_EMAIL,
  });

  const server = new Hono();
  server.route('/', createApp({ db, auth }));
  server.all('/api/*', () => apiError(404, 'not_found', 'Não encontrado.'));
  // Com `run_worker_first: ["/api/*"]` o resto nem chega aqui; fica como rede de segurança.
  server.all('*', (c) => env.ASSETS.fetch(c.req.raw));

  cached = { env, server };
  return server;
}

/** Ponto de entrada Cloudflare Workers / ChatGPT Sites: a mesma API Hono, sobre D1. */
export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    return serverFor(env).fetch(request);
  },
};

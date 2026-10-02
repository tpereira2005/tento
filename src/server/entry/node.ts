import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createApp } from '../app';
import { createAuth } from '../auth';
import { createLibsqlDb, migrateLibsql } from '../db/client';
import { loadEnv } from '../env';
import { apiError } from '../http';
import { isHttps, securityHeadersMiddleware } from '../security';

/** Ponto de entrada Node: lê a configuração, migra a BD e serve a API (e o `dist/` em produção). */
async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
  const env = loadEnv();

  if (env.DATABASE_URL.startsWith('file:')) {
    mkdirSync(dirname(env.DATABASE_URL.slice('file:'.length)), { recursive: true });
  }
  const { db } = await createLibsqlDb(env.DATABASE_URL);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  await migrateLibsql(db, resolve(root, 'drizzle'));

  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    registration: 'first-user-only',
    ownerEmail: env.OWNER_EMAIL,
  });

  const server = new Hono();
  // Cabeçalhos de segurança em TODAS as respostas (API e ficheiros estáticos).
  server.use('*', securityHeadersMiddleware({ https: isHttps(env.BETTER_AUTH_URL) }));
  server.route('/', createApp({ db, auth }));

  if (env.NODE_ENV === 'production') {
    server.all('/api/*', () => apiError(404, 'not_found', 'Não encontrado.'));
    server.use('*', serveStatic({ root: './dist' }));
    server.get('*', serveStatic({ path: './dist/index.html' }));
  }

  serve({ fetch: server.fetch, port: env.PORT }, (info) => {
    console.log(`Tento a ouvir em http://localhost:${info.port} (${env.NODE_ENV})`);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { createAuth } from '../src/server/auth';
import { createLibsqlDb, migrateLibsql } from '../src/server/db/client';
import { seedDemoData } from '../src/server/db/seed';
import { loadEnv } from '../src/server/env';

/**
 * Só para desenvolvimento local: cria o utilizador de demonstração (DEMO_EMAIL / DEMO_PASSWORD do `.env`)
 * e enche-o com dados fictícios (Ana/Rui, Casa A/Casa B). Nunca uses dados reais.
 */
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
if (!email || !password) {
  console.error('Define DEMO_EMAIL e DEMO_PASSWORD no .env (palavra-passe com pelo menos 12 caracteres).');
  process.exit(1);
}

const env = loadEnv();
const { db, client } = await createLibsqlDb(env.DATABASE_URL);
await migrateLibsql(db);
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  registration: 'first-user-only',
});

try {
  const { user } = await auth.api.signUpEmail({ body: { name: 'Demo', email, password } });
  await seedDemoData(db, user.id);
  console.log(`Utilizador de demonstração ${email} criado com dados fictícios.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.close();
}

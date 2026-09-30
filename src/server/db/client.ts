import { createClient } from '@libsql/client';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

/**
 * Base de dados assíncrona compatível com libSQL (local/Turso) e D1 (Cloudflare / ChatGPT Sites).
 * Os repositórios recebem este tipo, nunca um cliente concreto.
 *
 * Regra de portabilidade: escritas atómicas com `db.batch([...])`, não com `db.transaction()`
 * (o D1 não suporta transações interativas).
 */
export type Db = BaseSQLiteDatabase<'async', unknown, typeof schema>;

export { schema };

/** Cliente libSQL: `file:./data/tento.db` em desenvolvimento, `:memory:` nos testes. */
export function createLibsqlDb(url: string) {
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function migrateLibsql(
  db: ReturnType<typeof createLibsqlDb>['db'],
  migrationsFolder = 'drizzle',
) {
  await migrate(db, { migrationsFolder });
}

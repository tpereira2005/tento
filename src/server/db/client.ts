import { createClient } from '@libsql/client';
import type { BatchItem } from 'drizzle-orm/batch';
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
export type Db = BaseSQLiteDatabase<'async', unknown, typeof schema> & {
  /** Lote atómico: todas as instruções correm numa transação implícita ou nenhuma tem efeito. */
  batch(queries: readonly [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]): Promise<unknown>;
};

export { schema };

export type LibsqlDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Cliente libSQL: `file:./data/tento.db` em desenvolvimento, `:memory:` nos testes.
 * Liga as chaves estrangeiras (o SQLite vem com elas desligadas), sem as quais os `ON DELETE CASCADE` não correm.
 */
export async function createLibsqlDb(url: string) {
  const client = createClient({ url });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function migrateLibsql(db: LibsqlDb, migrationsFolder = 'drizzle') {
  await migrate(db, { migrationsFolder });
}

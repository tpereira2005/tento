import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createLibsqlDb, migrateLibsql } from '../src/server/db/client';

/** Aplica as migrações de `drizzle/` a `DATABASE_URL` (por omissão `file:./data/tento.db`). */
const url = process.env.DATABASE_URL ?? 'file:./data/tento.db';
if (url.startsWith('file:')) mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });

const { db, client } = await createLibsqlDb(url);
await migrateLibsql(db);
client.close();
console.log(`Migrações aplicadas a ${url}`);

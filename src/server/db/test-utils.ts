import { fileURLToPath } from 'node:url';
import { createLibsqlDb, migrateLibsql } from './client';
import { createBookmaker, createProfile, createWallet } from './repos';
import { user } from './schema';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Base `:memory:` nova, com migrações e dois utilizadores fictícios. */
export async function createTestDb() {
  const { db, client } = await createLibsqlDb(':memory:');
  await migrateLibsql(db, MIGRATIONS);
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  await db.insert(user).values([
    { id: userA, name: 'Utilizador A', email: 'a@exemplo.test' },
    { id: userB, name: 'Utilizador B', email: 'b@exemplo.test' },
  ]);
  return { db, client, userA, userB };
}

type TestDb = Awaited<ReturnType<typeof createTestDb>>['db'];

/** Cria perfil + casa + conta fictícios para `userId`. */
export async function makeWallet(db: TestDb, userId: string, profileName = 'Ana', bookmakerName = 'Casa A') {
  const p = await createProfile(db, userId, { name: profileName });
  const b = await createBookmaker(db, userId, { name: bookmakerName });
  if (!p.ok || !b.ok) throw new Error('makeWallet: perfil ou casa não criados');
  const w = await createWallet(db, userId, { profileId: p.value.id, bookmakerId: b.value.id });
  if (!w.ok) throw new Error('makeWallet: conta não criada');
  return { profileId: p.value.id, bookmakerId: b.value.id, walletId: w.value.id };
}

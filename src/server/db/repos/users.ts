import { count } from 'drizzle-orm';
import type { Db } from '../client';
import { user } from '../schema';

/** Número de utilizadores registados (o registo público fecha depois do primeiro). */
export async function countUsers(db: Db): Promise<number> {
  const rows = await db.select({ n: count() }).from(user);
  return rows[0]?.n ?? 0;
}

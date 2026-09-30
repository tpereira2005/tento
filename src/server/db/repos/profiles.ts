import { and, eq, sql } from 'drizzle-orm';
import { err, ok, type Result } from '../../../core/types';
import type { Db } from '../client';
import { profile } from '../schema';
import { newId, normalizeName } from './shared';

export interface Profile {
  id: string;
  name: string;
  createdAt: Date;
}

const columns = { id: profile.id, name: profile.name, createdAt: profile.createdAt };

export async function listProfiles(db: Db, userId: string): Promise<Profile[]> {
  return db
    .select(columns)
    .from(profile)
    .where(eq(profile.userId, userId))
    .orderBy(sql`${profile.name} collate nocase`, profile.id);
}

/** Existe outro perfil do utilizador com o mesmo nome (sem distinguir maiúsculas)? */
async function nameTaken(db: Db, userId: string, name: string, exceptId?: string): Promise<boolean> {
  const wanted = name.toLowerCase();
  const rows = await db
    .select({ id: profile.id, name: profile.name })
    .from(profile)
    .where(eq(profile.userId, userId));
  return rows.some((r) => r.id !== exceptId && r.name.toLowerCase() === wanted);
}

export async function createProfile(
  db: Db,
  userId: string,
  input: { name: string },
): Promise<Result<Profile, 'duplicate' | 'invalid_name'>> {
  const name = normalizeName(input.name);
  if (name === null) return err('invalid_name');
  if (await nameTaken(db, userId, name)) return err('duplicate');
  const rows = await db
    .insert(profile)
    .values({ id: newId(), userId, name })
    .onConflictDoNothing()
    .returning(columns);
  const row = rows[0];
  return row ? ok(row) : err('duplicate');
}

export async function renameProfile(
  db: Db,
  userId: string,
  id: string,
  input: { name: string },
): Promise<Result<Profile, 'not_found' | 'duplicate' | 'invalid_name'>> {
  const name = normalizeName(input.name);
  if (name === null) return err('invalid_name');
  const current = await db
    .select({ id: profile.id })
    .from(profile)
    .where(and(eq(profile.id, id), eq(profile.userId, userId)));
  if (current.length === 0) return err('not_found');
  if (await nameTaken(db, userId, name, id)) return err('duplicate');
  const rows = await db
    .update(profile)
    .set({ name })
    .where(and(eq(profile.id, id), eq(profile.userId, userId)))
    .returning(columns);
  const row = rows[0];
  return row ? ok(row) : err('not_found');
}

/** Apaga o perfil e, em cascata, as suas contas e transações. */
export async function deleteProfile(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(profile)
    .where(and(eq(profile.id, id), eq(profile.userId, userId)))
    .returning({ id: profile.id });
  return rows.length > 0;
}

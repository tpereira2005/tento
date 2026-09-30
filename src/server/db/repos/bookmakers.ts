import { and, eq, ne, sql } from 'drizzle-orm';
import { err, ok, type Result } from '../../../core/types';
import type { Db } from '../client';
import { bookmaker } from '../schema';
import { newId, normalizeName } from './shared';

export interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export type BookmakerNameError = 'invalid_name';

const columns = {
  id: bookmaker.id,
  name: bookmaker.name,
  slug: bookmaker.slug,
  createdAt: bookmaker.createdAt,
};

/** `Casa Ágil!` → `casa-agil`: minúsculas, sem acentos, não alfanuméricos viram `-`. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function prepare(rawName: string): { name: string; slug: string } | null {
  const name = normalizeName(rawName);
  if (name === null) return null;
  const slug = slugify(name);
  return slug === '' ? null : { name, slug };
}

export async function listBookmakers(db: Db, userId: string): Promise<Bookmaker[]> {
  return db
    .select(columns)
    .from(bookmaker)
    .where(eq(bookmaker.userId, userId))
    .orderBy(sql`${bookmaker.name} collate nocase`, bookmaker.id);
}

export async function createBookmaker(
  db: Db,
  userId: string,
  input: { name: string },
): Promise<Result<Bookmaker, 'duplicate' | 'invalid_name'>> {
  const prepared = prepare(input.name);
  if (!prepared) return err('invalid_name');
  const rows = await db
    .insert(bookmaker)
    .values({ id: newId(), userId, ...prepared })
    .onConflictDoNothing()
    .returning(columns);
  const row = rows[0];
  return row ? ok(row) : err('duplicate');
}

export async function renameBookmaker(
  db: Db,
  userId: string,
  id: string,
  input: { name: string },
): Promise<Result<Bookmaker, 'not_found' | 'duplicate' | 'invalid_name'>> {
  const prepared = prepare(input.name);
  if (!prepared) return err('invalid_name');
  const current = await db
    .select({ id: bookmaker.id })
    .from(bookmaker)
    .where(and(eq(bookmaker.id, id), eq(bookmaker.userId, userId)));
  if (current.length === 0) return err('not_found');
  const clash = await db
    .select({ id: bookmaker.id })
    .from(bookmaker)
    .where(and(eq(bookmaker.userId, userId), eq(bookmaker.slug, prepared.slug), ne(bookmaker.id, id)));
  if (clash.length > 0) return err('duplicate');
  const rows = await db
    .update(bookmaker)
    .set(prepared)
    .where(and(eq(bookmaker.id, id), eq(bookmaker.userId, userId)))
    .returning(columns);
  const row = rows[0];
  return row ? ok(row) : err('not_found');
}

/** Apaga a casa e, em cascata, as suas contas e transações. */
export async function deleteBookmaker(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(bookmaker)
    .where(and(eq(bookmaker.id, id), eq(bookmaker.userId, userId)))
    .returning({ id: bookmaker.id });
  return rows.length > 0;
}

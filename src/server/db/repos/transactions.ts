import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import { isIsoDate } from '../../../core/dates';
import { err, ok, type IsoDate, type Result, type Transaction, type TxnType } from '../../../core/types';
import type { Db } from '../client';
import { bookmaker, profile, TXN_TYPES, txn, wallet } from '../schema';
import { newId } from './shared';

export interface TxnFilter {
  walletIds?: readonly string[];
  profileIds?: readonly string[];
  bookmakerIds?: readonly string[];
  from?: IsoDate;
  to?: IsoDate;
}

export type TxnView = Transaction & {
  source: 'csv' | 'manual';
  note: string | null;
  profileName: string;
  bookmakerName: string;
  importBatchId: string | null;
};

export const NOTE_MAX_LENGTH = 500;
export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

/** Cursor de paginação malformado (a API deve responder 400). */
export class InvalidCursorError extends Error {
  constructor() {
    super('Cursor de paginação inválido.');
    this.name = 'InvalidCursorError';
  }
}

const txnColumns = {
  id: txn.id,
  walletId: txn.walletId,
  date: txn.date,
  type: txn.type,
  amountCents: txn.amountCents,
  seq: txn.seq,
};

const viewColumns = {
  ...txnColumns,
  source: txn.source,
  note: txn.note,
  importBatchId: txn.importBatchId,
  profileName: profile.name,
  bookmakerName: bookmaker.name,
};

function toTransaction<T extends { date: string }>(row: T): Omit<T, 'date'> & { date: IsoDate } {
  return { ...row, date: row.date as IsoDate };
}

function conditions(userId: string, filter: TxnFilter | undefined): SQL[] {
  const out: SQL[] = [eq(txn.userId, userId)];
  if (filter?.walletIds) out.push(inArray(txn.walletId, [...filter.walletIds]));
  if (filter?.profileIds) out.push(inArray(wallet.profileId, [...filter.profileIds]));
  if (filter?.bookmakerIds) out.push(inArray(wallet.bookmakerId, [...filter.bookmakerIds]));
  if (filter?.from !== undefined) out.push(gte(txn.date, filter.from));
  if (filter?.to !== undefined) out.push(lte(txn.date, filter.to));
  return out;
}

/** Todas as transações que cumprem o filtro, sem limite de linhas, por data, conta e posição. */
export async function listTransactions(db: Db, userId: string, filter?: TxnFilter): Promise<Transaction[]> {
  const rows = await db
    .select(txnColumns)
    .from(txn)
    .innerJoin(wallet, eq(wallet.id, txn.walletId))
    .where(and(...conditions(userId, filter)))
    .orderBy(asc(txn.date), asc(txn.walletId), asc(txn.seq), asc(txn.id));
  return rows.map(toTransaction);
}

// ─── Paginação por cursor (keyset) ──────────────────────────────────────────────

function encodeCursor(row: { date: string; seq: number; id: string }): string {
  return btoa(JSON.stringify([row.date, row.seq, row.id]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeCursor(cursor: string): { date: string; seq: number; id: string } {
  try {
    const parsed: unknown = JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')));
    if (Array.isArray(parsed) && parsed.length === 3) {
      const [date, seq, id] = parsed as unknown[];
      if (typeof date === 'string' && typeof seq === 'number' && typeof id === 'string') {
        return { date, seq, id };
      }
    }
  } catch {
    // cai para o erro abaixo
  }
  throw new InvalidCursorError();
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface PageQuery {
  filter?: TxnFilter;
  type?: TxnType;
  /** Procura no texto da nota. */
  search?: string;
  /** 1–200 (por omissão 50). */
  limit?: number;
  cursor?: string;
}

/** Ordem: data ↓, posição ↓, id ↓. `total` conta todas as linhas do filtro, independentemente do cursor. */
export async function pageTransactions(
  db: Db,
  userId: string,
  query: PageQuery = {},
): Promise<{ items: TxnView[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Math.trunc(query.limit ?? PAGE_SIZE_DEFAULT)));
  const base = conditions(userId, query.filter);
  if (query.type !== undefined) base.push(eq(txn.type, query.type));
  const search = query.search?.trim();
  if (search) base.push(sql`${txn.note} like ${`%${escapeLike(search)}%`} escape '\\'`);

  const page = [...base];
  if (query.cursor !== undefined) {
    const c = decodeCursor(query.cursor);
    const after = or(
      lt(txn.date, c.date),
      and(eq(txn.date, c.date), lt(txn.seq, c.seq)),
      and(eq(txn.date, c.date), eq(txn.seq, c.seq), lt(txn.id, c.id)),
    );
    if (after) page.push(after);
  }

  const [rows, totals] = await Promise.all([
    db
      .select(viewColumns)
      .from(txn)
      .innerJoin(wallet, eq(wallet.id, txn.walletId))
      .innerJoin(profile, eq(profile.id, wallet.profileId))
      .innerJoin(bookmaker, eq(bookmaker.id, wallet.bookmakerId))
      .where(and(...page))
      .orderBy(desc(txn.date), desc(txn.seq), desc(txn.id))
      .limit(limit + 1),
    db
      .select({ n: sql<number>`count(*)` })
      .from(txn)
      .innerJoin(wallet, eq(wallet.id, txn.walletId))
      .where(and(...base)),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toTransaction);
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    total: totals[0]?.n ?? 0,
  };
}

// ─── Escrita manual ─────────────────────────────────────────────────────────────

async function loadView(db: Db, userId: string, id: string): Promise<TxnView | null> {
  const rows = await db
    .select(viewColumns)
    .from(txn)
    .innerJoin(wallet, eq(wallet.id, txn.walletId))
    .innerJoin(profile, eq(profile.id, wallet.profileId))
    .innerJoin(bookmaker, eq(bookmaker.id, wallet.bookmakerId))
    .where(and(eq(txn.id, id), eq(txn.userId, userId)));
  const row = rows[0];
  return row ? toTransaction(row) : null;
}

const validAmount = (n: number) => Number.isSafeInteger(n) && n > 0;
const validType = (t: string): t is TxnType => (TXN_TYPES as readonly string[]).includes(t);

/** Nota aparada; vazia vira `null`. `undefined` = inválida (demasiado longa). */
function cleanNote(note: string | null | undefined): string | null | undefined {
  if (note === null || note === undefined) return null;
  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX_LENGTH) return undefined;
  return trimmed === '' ? null : trimmed;
}

export async function createManualTransaction(
  db: Db,
  userId: string,
  input: { walletId: string; date: IsoDate; type: TxnType; amountCents: number; note?: string },
): Promise<Result<TxnView, 'not_found' | 'invalid'>> {
  const note = cleanNote(input.note);
  if (
    !validAmount(input.amountCents) ||
    !isIsoDate(input.date) ||
    !validType(input.type) ||
    note === undefined
  ) {
    return err('invalid');
  }
  const owned = await db
    .select({ id: wallet.id })
    .from(wallet)
    .where(and(eq(wallet.id, input.walletId), eq(wallet.userId, userId)));
  if (owned.length === 0) return err('not_found');

  const id = newId();
  await db.insert(txn).values({
    id,
    userId,
    walletId: input.walletId,
    date: input.date,
    type: input.type,
    amountCents: input.amountCents,
    // contagem atómica dentro do próprio INSERT
    seq: sql`(select count(*) from txn where wallet_id = ${input.walletId} and date = ${input.date})`,
    source: 'manual',
    note,
  });
  const view = await loadView(db, userId, id);
  return view ? ok(view) : err('not_found');
}

export async function updateTransaction(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<{ date: IsoDate; type: TxnType; amountCents: number; note: string | null }>,
): Promise<Result<TxnView, 'not_found' | 'invalid'>> {
  const current = await loadView(db, userId, id);
  if (!current) return err('not_found');

  const set: { [K in keyof typeof txn.$inferInsert]?: (typeof txn.$inferInsert)[K] | SQL } = {};
  if (patch.amountCents !== undefined) {
    if (!validAmount(patch.amountCents)) return err('invalid');
    set.amountCents = patch.amountCents;
  }
  if (patch.type !== undefined) {
    if (!validType(patch.type)) return err('invalid');
    set.type = patch.type;
  }
  if (patch.note !== undefined) {
    const note = cleanNote(patch.note);
    if (note === undefined) return err('invalid');
    set.note = note;
  }
  if (patch.date !== undefined) {
    if (!isIsoDate(patch.date)) return err('invalid');
    if (patch.date !== current.date) {
      set.date = patch.date;
      // passa para o fim do novo dia
      set.seq = sql`(select count(*) from txn where wallet_id = ${current.walletId} and date = ${patch.date})`;
    }
  }
  if (Object.keys(set).length > 0) {
    await db
      .update(txn)
      .set(set)
      .where(and(eq(txn.id, id), eq(txn.userId, userId)));
  }
  const view = await loadView(db, userId, id);
  return view ? ok(view) : err('not_found');
}

export async function deleteTransaction(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(txn)
    .where(and(eq(txn.id, id), eq(txn.userId, userId)))
    .returning({ id: txn.id });
  return rows.length > 0;
}

/** Linhas já guardadas de uma conta, no formato que `diffTransactions` espera. */
export async function existingForDiff(
  db: Db,
  userId: string,
  walletId: string,
): Promise<{ id: string; date: IsoDate; type: TxnType; amountCents: number }[]> {
  const rows = await db
    .select({ id: txn.id, date: txn.date, type: txn.type, amountCents: txn.amountCents })
    .from(txn)
    .where(and(eq(txn.userId, userId), eq(txn.walletId, walletId)))
    .orderBy(asc(txn.date), asc(txn.seq), asc(txn.id));
  return rows.map(toTransaction);
}

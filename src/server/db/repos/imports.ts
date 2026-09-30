import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { ParsedRow } from '../../../core/csv';
import { err, ok, type Result } from '../../../core/types';
import type { Db } from '../client';
import { bookmaker, importBatch, profile, txn, wallet } from '../schema';
import { newId } from './shared';

/**
 * Linhas por instrução `INSERT` multi-linha. Cada linha usa ~10 parâmetros; em D1 (limite de 100 parâmetros
 * por consulta) o valor terá de baixar para 9 quando o adaptador D1 for ligado.
 */
export const INSERT_CHUNK_ROWS = 200;

export interface ImportBatchView {
  id: string;
  walletId: string;
  profileName: string;
  bookmakerName: string;
  filename: string;
  rowsTotal: number;
  rowsAdded: number;
  rowsDuplicate: number;
  rowsInvalid: number;
  rowsConflict: number;
  createdAt: Date;
  undoneAt: Date | null;
}

export interface CommitImportInput {
  walletId: string;
  filename: string;
  fileSha256: string;
  rowsTotal: number;
  rowsInvalid: number;
  rowsDuplicate: number;
  rowsConflict: number;
  /** Só as linhas a adicionar. */
  rows: readonly ParsedRow[];
}

const viewColumns = {
  id: importBatch.id,
  walletId: importBatch.walletId,
  profileName: profile.name,
  bookmakerName: bookmaker.name,
  filename: importBatch.filename,
  rowsTotal: importBatch.rowsTotal,
  rowsAdded: importBatch.rowsAdded,
  rowsDuplicate: importBatch.rowsDuplicate,
  rowsInvalid: importBatch.rowsInvalid,
  rowsConflict: importBatch.rowsConflict,
  createdAt: importBatch.createdAt,
  undoneAt: importBatch.undoneAt,
};

function selectViews(db: Db) {
  return db
    .select(viewColumns)
    .from(importBatch)
    .innerJoin(wallet, eq(wallet.id, importBatch.walletId))
    .innerJoin(profile, eq(profile.id, wallet.profileId))
    .innerJoin(bookmaker, eq(bookmaker.id, wallet.bookmakerId));
}

async function loadImport(db: Db, userId: string, id: string): Promise<ImportBatchView | null> {
  const rows = await selectViews(db).where(and(eq(importBatch.id, id), eq(importBatch.userId, userId)));
  return rows[0] ?? null;
}

/**
 * Regista o import e as suas linhas num único `db.batch`: ou fica tudo, ou não fica nada.
 * `seq` de cada linha nova = linhas já existentes nessa conta e data + posição da linha no ficheiro.
 */
export async function commitImport(
  db: Db,
  userId: string,
  input: CommitImportInput,
): Promise<Result<ImportBatchView, 'not_found'>> {
  const owned = await db
    .select({ id: wallet.id })
    .from(wallet)
    .where(and(eq(wallet.id, input.walletId), eq(wallet.userId, userId)));
  if (owned.length === 0) return err('not_found');

  const existing = await db
    .select({ date: txn.date, n: count() })
    .from(txn)
    .where(and(eq(txn.userId, userId), eq(txn.walletId, input.walletId)))
    .groupBy(txn.date);
  const baseSeq = new Map(existing.map((e) => [e.date, e.n]));

  const batchId = newId();
  const values = input.rows.map((row) => ({
    id: newId(),
    userId,
    walletId: input.walletId,
    date: row.date,
    type: row.type,
    amountCents: row.amountCents,
    seq: (baseSeq.get(row.date) ?? 0) + row.seq,
    source: 'csv' as const,
    importBatchId: batchId,
  }));

  const insertBatch = db.insert(importBatch).values({
    id: batchId,
    userId,
    walletId: input.walletId,
    filename: input.filename,
    fileSha256: input.fileSha256,
    rowsTotal: input.rowsTotal,
    rowsAdded: values.length,
    rowsDuplicate: input.rowsDuplicate,
    rowsInvalid: input.rowsInvalid,
    rowsConflict: input.rowsConflict,
  });
  const inserts = [];
  for (let i = 0; i < values.length; i += INSERT_CHUNK_ROWS) {
    inserts.push(db.insert(txn).values(values.slice(i, i + INSERT_CHUNK_ROWS)));
  }
  await db.batch([insertBatch, ...inserts]);

  const view = await loadImport(db, userId, batchId);
  return view ? ok(view) : err('not_found');
}

/** Imports do utilizador, do mais recente para o mais antigo. */
export async function listImports(db: Db, userId: string): Promise<ImportBatchView[]> {
  return selectViews(db)
    .where(eq(importBatch.userId, userId))
    .orderBy(desc(importBatch.createdAt), desc(importBatch.id));
}

/** Desfaz um import: apaga as suas transações e marca-o como desfeito, num único lote. */
export async function undoImport(
  db: Db,
  userId: string,
  batchId: string,
): Promise<Result<ImportBatchView, 'not_found' | 'already_undone'>> {
  const current = await loadImport(db, userId, batchId);
  if (!current) return err('not_found');
  if (current.undoneAt) return err('already_undone');
  await db.batch([
    db.delete(txn).where(and(eq(txn.importBatchId, batchId), eq(txn.userId, userId))),
    db
      .update(importBatch)
      .set({ undoneAt: new Date() })
      .where(and(eq(importBatch.id, batchId), eq(importBatch.userId, userId), isNull(importBatch.undoneAt))),
  ]);
  const view = await loadImport(db, userId, batchId);
  return view ? ok(view) : err('not_found');
}

import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { bookmaker, importBatch, profile, txn, user, userSettings, wallet } from '../schema';
import { getSettings, type Settings } from './settings';

/** Formato do ficheiro de exportação (`GET /api/me/export`). */
export const EXPORT_FORMAT = 'tento-export';
export const EXPORT_VERSION = 1;

export interface UserExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  user: { name: string; email: string };
  settings: Settings;
  profiles: { id: string; name: string; createdAt: string }[];
  bookmakers: { id: string; name: string; slug: string; createdAt: string }[];
  wallets: { id: string; profileId: string; bookmakerId: string; createdAt: string }[];
  imports: {
    id: string;
    walletId: string;
    filename: string;
    fileSha256: string;
    rowsTotal: number;
    rowsAdded: number;
    rowsDuplicate: number;
    rowsInvalid: number;
    rowsConflict: number;
    createdAt: string;
    undoneAt: string | null;
  }[];
  transactions: {
    id: string;
    walletId: string;
    date: string;
    type: 'deposit' | 'withdrawal';
    amountCents: number;
    seq: number;
    source: 'csv' | 'manual';
    importBatchId: string | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

const iso = (d: Date) => d.toISOString();

/**
 * Todos os dados do utilizador (sem palavra-passe, sessões nem contas de autenticação).
 * Seleções simples por `user_id`, sem listas de parâmetros: compatível com os limites do D1.
 */
export async function exportUserData(db: Db, userId: string, now: Date): Promise<UserExport | null> {
  const owner = (
    await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId))
  )[0];
  if (!owner) return null;
  const [settings, profiles, bookmakers, wallets, imports, txns] = await Promise.all([
    getSettings(db, userId),
    db
      .select({ id: profile.id, name: profile.name, createdAt: profile.createdAt })
      .from(profile)
      .where(eq(profile.userId, userId))
      .orderBy(profile.createdAt, profile.id),
    db
      .select({
        id: bookmaker.id,
        name: bookmaker.name,
        slug: bookmaker.slug,
        createdAt: bookmaker.createdAt,
      })
      .from(bookmaker)
      .where(eq(bookmaker.userId, userId))
      .orderBy(bookmaker.createdAt, bookmaker.id),
    db
      .select({
        id: wallet.id,
        profileId: wallet.profileId,
        bookmakerId: wallet.bookmakerId,
        createdAt: wallet.createdAt,
      })
      .from(wallet)
      .where(eq(wallet.userId, userId))
      .orderBy(wallet.createdAt, wallet.id),
    db
      .select({
        id: importBatch.id,
        walletId: importBatch.walletId,
        filename: importBatch.filename,
        fileSha256: importBatch.fileSha256,
        rowsTotal: importBatch.rowsTotal,
        rowsAdded: importBatch.rowsAdded,
        rowsDuplicate: importBatch.rowsDuplicate,
        rowsInvalid: importBatch.rowsInvalid,
        rowsConflict: importBatch.rowsConflict,
        createdAt: importBatch.createdAt,
        undoneAt: importBatch.undoneAt,
      })
      .from(importBatch)
      .where(eq(importBatch.userId, userId))
      .orderBy(importBatch.createdAt, importBatch.id),
    db
      .select({
        id: txn.id,
        walletId: txn.walletId,
        date: txn.date,
        type: txn.type,
        amountCents: txn.amountCents,
        seq: txn.seq,
        source: txn.source,
        importBatchId: txn.importBatchId,
        note: txn.note,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
      })
      .from(txn)
      .where(eq(txn.userId, userId))
      .orderBy(txn.date, txn.seq, txn.id),
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    user: owner,
    settings,
    profiles: profiles.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
    bookmakers: bookmakers.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
    wallets: wallets.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
    imports: imports.map((r) => ({
      ...r,
      createdAt: iso(r.createdAt),
      undoneAt: r.undoneAt ? iso(r.undoneAt) : null,
    })),
    transactions: txns.map((r) => ({ ...r, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) })),
  };
}

/**
 * Apaga TODOS os dados de domínio do utilizador (transações, importações, contas, perfis, casas e
 * preferências), mantendo a conta de autenticação. Lote atómico (`db.batch`), por ordem de dependência.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  await db.batch([
    db.delete(txn).where(eq(txn.userId, userId)),
    db.delete(importBatch).where(eq(importBatch.userId, userId)),
    db.delete(wallet).where(eq(wallet.userId, userId)),
    db.delete(profile).where(eq(profile.userId, userId)),
    db.delete(bookmaker).where(eq(bookmaker.userId, userId)),
    db.delete(userSettings).where(eq(userSettings.userId, userId)),
  ]);
}

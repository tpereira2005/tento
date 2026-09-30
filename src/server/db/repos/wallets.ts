import { and, count, eq, max, isNull, sql } from 'drizzle-orm';
import { err, ok, type IsoDate, type Result, type WalletRef } from '../../../core/types';
import type { Db } from '../client';
import { bookmaker, importBatch, profile, txn, wallet } from '../schema';
import { newId } from './shared';

export interface WalletView {
  id: string;
  profileId: string;
  profileName: string;
  bookmakerId: string;
  bookmakerName: string;
  txnCount: number;
  lastTxnDate: IsoDate | null;
  /** Último import ainda válido (não desfeito). */
  lastImportAt: Date | null;
}

async function loadWallets(db: Db, userId: string, walletId?: string): Promise<WalletView[]> {
  const scope = walletId === undefined ? [] : [eq(wallet.id, walletId)];
  const rows = await db
    .select({
      id: wallet.id,
      profileId: wallet.profileId,
      profileName: profile.name,
      bookmakerId: wallet.bookmakerId,
      bookmakerName: bookmaker.name,
    })
    .from(wallet)
    .innerJoin(profile, eq(profile.id, wallet.profileId))
    .innerJoin(bookmaker, eq(bookmaker.id, wallet.bookmakerId))
    .where(and(eq(wallet.userId, userId), ...scope))
    .orderBy(sql`${profile.name} collate nocase`, sql`${bookmaker.name} collate nocase`, wallet.id);

  const txnStats = await db
    .select({ walletId: txn.walletId, n: count(), last: max(txn.date) })
    .from(txn)
    .where(and(eq(txn.userId, userId), ...(walletId === undefined ? [] : [eq(txn.walletId, walletId)])))
    .groupBy(txn.walletId);
  const importStats = await db
    .select({ walletId: importBatch.walletId, last: max(importBatch.createdAt) })
    .from(importBatch)
    .where(
      and(
        eq(importBatch.userId, userId),
        isNull(importBatch.undoneAt),
        ...(walletId === undefined ? [] : [eq(importBatch.walletId, walletId)]),
      ),
    )
    .groupBy(importBatch.walletId);

  const txnByWallet = new Map(txnStats.map((s) => [s.walletId, s]));
  const importByWallet = new Map(importStats.map((s) => [s.walletId, s.last]));
  return rows.map((r) => {
    const stats = txnByWallet.get(r.id);
    return {
      ...r,
      txnCount: stats?.n ?? 0,
      lastTxnDate: (stats?.last ?? null) as IsoDate | null,
      lastImportAt: importByWallet.get(r.id) ?? null,
    };
  });
}

export async function listWallets(db: Db, userId: string): Promise<WalletView[]> {
  return loadWallets(db, userId);
}

export async function createWallet(
  db: Db,
  userId: string,
  input: { profileId: string; bookmakerId: string },
): Promise<Result<WalletView, 'not_found' | 'duplicate'>> {
  const [profiles, bookmakers] = await Promise.all([
    db
      .select({ id: profile.id })
      .from(profile)
      .where(and(eq(profile.id, input.profileId), eq(profile.userId, userId))),
    db
      .select({ id: bookmaker.id })
      .from(bookmaker)
      .where(and(eq(bookmaker.id, input.bookmakerId), eq(bookmaker.userId, userId))),
  ]);
  if (profiles.length === 0 || bookmakers.length === 0) return err('not_found');
  const id = newId();
  const rows = await db
    .insert(wallet)
    .values({ id, userId, profileId: input.profileId, bookmakerId: input.bookmakerId })
    .onConflictDoNothing()
    .returning({ id: wallet.id });
  if (rows.length === 0) return err('duplicate');
  const view = (await loadWallets(db, userId, id))[0];
  return view ? ok(view) : err('not_found');
}

/** Apaga a conta e, em cascata, as suas transações e imports. */
export async function deleteWallet(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(wallet)
    .where(and(eq(wallet.id, id), eq(wallet.userId, userId)))
    .returning({ id: wallet.id });
  return rows.length > 0;
}

export async function walletRefs(db: Db, userId: string): Promise<WalletRef[]> {
  return db
    .select({ id: wallet.id, profileId: wallet.profileId, bookmakerId: wallet.bookmakerId })
    .from(wallet)
    .where(eq(wallet.userId, userId))
    .orderBy(wallet.createdAt, wallet.id);
}

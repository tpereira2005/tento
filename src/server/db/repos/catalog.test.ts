import { beforeEach, describe, expect, it } from 'vitest';
import type { IsoDate } from '../../../core/types';
import { createTestDb, makeWallet } from '../test-utils';
import {
  countUsers,
  createBookmaker,
  createManualTransaction,
  createProfile,
  createWallet,
  deleteBookmaker,
  deleteProfile,
  deleteWallet,
  getSettings,
  listBookmakers,
  listProfiles,
  listTransactions,
  listWallets,
  renameBookmaker,
  renameProfile,
  slugify,
  updateSettings,
  walletRefs,
} from '.';

const d = (s: string) => s as IsoDate;

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});

describe('client', () => {
  it('ativa as chaves estrangeiras (cascades funcionam)', async () => {
    const res = await t.client.execute('PRAGMA foreign_keys');
    expect(res.rows[0]?.foreign_keys).toBe(1);
  });

  it('countUsers conta os utilizadores', async () => {
    expect(await countUsers(t.db)).toBe(2);
  });
});

describe('slugify', () => {
  it('minúsculas, sem acentos, não alfanuméricos viram hífen', () => {
    expect(slugify('  Casa Ágil & Cª! ')).toBe('casa-agil-c');
    expect(slugify('Casa A')).toBe('casa-a');
    expect(slugify('!!!')).toBe('');
  });
});

describe('bookmakers', () => {
  it('cria, lista ordenada por nome e normaliza', async () => {
    const b = await createBookmaker(t.db, t.userA, { name: '  Casa B ' });
    const a = await createBookmaker(t.db, t.userA, { name: 'casa A' });
    expect(b.ok && b.value.name).toBe('Casa B');
    expect(b.ok && b.value.slug).toBe('casa-b');
    expect(a.ok && a.value.createdAt).toBeInstanceOf(Date);
    expect((await listBookmakers(t.db, t.userA)).map((x) => x.name)).toEqual(['casa A', 'Casa B']);
  });

  it('rejeita nomes inválidos e duplicados (por slug)', async () => {
    expect(await createBookmaker(t.db, t.userA, { name: '   ' })).toEqual({
      ok: false,
      error: 'invalid_name',
    });
    expect(await createBookmaker(t.db, t.userA, { name: 'x'.repeat(61) })).toEqual({
      ok: false,
      error: 'invalid_name',
    });
    expect(await createBookmaker(t.db, t.userA, { name: '***' })).toEqual({
      ok: false,
      error: 'invalid_name',
    });
    await createBookmaker(t.db, t.userA, { name: 'Casa A' });
    expect(await createBookmaker(t.db, t.userA, { name: 'CASA  a' })).toEqual({
      ok: false,
      error: 'duplicate',
    });
    // outro utilizador pode usar o mesmo nome
    expect((await createBookmaker(t.db, t.userB, { name: 'Casa A' })).ok).toBe(true);
  });

  it('renomeia, detecta duplicado, inválido e inexistente', async () => {
    const a = await createBookmaker(t.db, t.userA, { name: 'Casa A' });
    await createBookmaker(t.db, t.userA, { name: 'Casa B' });
    if (!a.ok) throw new Error('setup');
    const renamed = await renameBookmaker(t.db, t.userA, a.value.id, { name: 'Casa C' });
    expect(renamed.ok && renamed.value.slug).toBe('casa-c');
    expect(await renameBookmaker(t.db, t.userA, a.value.id, { name: 'casa b' })).toEqual({
      ok: false,
      error: 'duplicate',
    });
    expect(await renameBookmaker(t.db, t.userA, a.value.id, { name: '' })).toEqual({
      ok: false,
      error: 'invalid_name',
    });
    expect(await renameBookmaker(t.db, t.userA, 'nao-existe', { name: 'X' })).toEqual({
      ok: false,
      error: 'not_found',
    });
    // renomear para o próprio nome é permitido
    expect((await renameBookmaker(t.db, t.userA, a.value.id, { name: 'Casa C' })).ok).toBe(true);
  });

  it('isolamento: outro utilizador não vê, renomeia nem apaga', async () => {
    const a = await createBookmaker(t.db, t.userA, { name: 'Casa A' });
    if (!a.ok) throw new Error('setup');
    expect(await listBookmakers(t.db, t.userB)).toEqual([]);
    expect(await renameBookmaker(t.db, t.userB, a.value.id, { name: 'Roubada' })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deleteBookmaker(t.db, t.userB, a.value.id)).toBe(false);
    expect((await listBookmakers(t.db, t.userA))[0]?.name).toBe('Casa A');
  });

  it('apagar devolve false se não existir e faz cascata para contas e transações', async () => {
    const w = await makeWallet(t.db, t.userA);
    await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: d('2026-01-05'),
      type: 'deposit',
      amountCents: 1000,
    });
    expect(await deleteBookmaker(t.db, t.userA, 'nao-existe')).toBe(false);
    expect(await deleteBookmaker(t.db, t.userA, w.bookmakerId)).toBe(true);
    expect(await listWallets(t.db, t.userA)).toEqual([]);
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
    expect(await listProfiles(t.db, t.userA)).toHaveLength(1);
  });
});

describe('profiles', () => {
  it('cria, lista e rejeita inválidos / duplicados sem distinguir maiúsculas', async () => {
    const rui = await createProfile(t.db, t.userA, { name: 'Rui' });
    await createProfile(t.db, t.userA, { name: ' Ana ' });
    expect(rui.ok && rui.value.createdAt).toBeInstanceOf(Date);
    expect((await listProfiles(t.db, t.userA)).map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect(await createProfile(t.db, t.userA, { name: 'ANA' })).toEqual({ ok: false, error: 'duplicate' });
    expect(await createProfile(t.db, t.userA, { name: '' })).toEqual({ ok: false, error: 'invalid_name' });
    expect((await createProfile(t.db, t.userB, { name: 'Ana' })).ok).toBe(true);
  });

  it('renomeia', async () => {
    const ana = await createProfile(t.db, t.userA, { name: 'Ana' });
    await createProfile(t.db, t.userA, { name: 'Rui' });
    if (!ana.ok) throw new Error('setup');
    const r = await renameProfile(t.db, t.userA, ana.value.id, { name: 'Ana Maria' });
    expect(r.ok && r.value.name).toBe('Ana Maria');
    expect(await renameProfile(t.db, t.userA, ana.value.id, { name: 'rui' })).toEqual({
      ok: false,
      error: 'duplicate',
    });
    expect(await renameProfile(t.db, t.userA, ana.value.id, { name: '  ' })).toEqual({
      ok: false,
      error: 'invalid_name',
    });
    expect(await renameProfile(t.db, t.userA, 'x', { name: 'Y' })).toEqual({ ok: false, error: 'not_found' });
    expect((await renameProfile(t.db, t.userA, ana.value.id, { name: 'ana maria' })).ok).toBe(true);
  });

  it('isolamento e cascata', async () => {
    const w = await makeWallet(t.db, t.userA);
    expect(await listProfiles(t.db, t.userB)).toEqual([]);
    expect(await renameProfile(t.db, t.userB, w.profileId, { name: 'X' })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deleteProfile(t.db, t.userB, w.profileId)).toBe(false);
    expect(await deleteProfile(t.db, t.userA, 'nao-existe')).toBe(false);
    expect(await deleteProfile(t.db, t.userA, w.profileId)).toBe(true);
    expect(await listWallets(t.db, t.userA)).toEqual([]);
    expect(await listBookmakers(t.db, t.userA)).toHaveLength(1);
  });
});

describe('wallets', () => {
  it('cria, deteta duplicado e lista com estatísticas, ordenada por perfil e casa', async () => {
    const ana = await createProfile(t.db, t.userA, { name: 'Ana' });
    const rui = await createProfile(t.db, t.userA, { name: 'Rui' });
    const a = await createBookmaker(t.db, t.userA, { name: 'Casa A' });
    const b = await createBookmaker(t.db, t.userA, { name: 'Casa B' });
    if (!ana.ok || !rui.ok || !a.ok || !b.ok) throw new Error('setup');
    const rb = await createWallet(t.db, t.userA, { profileId: rui.value.id, bookmakerId: b.value.id });
    const ab = await createWallet(t.db, t.userA, { profileId: ana.value.id, bookmakerId: b.value.id });
    const aa = await createWallet(t.db, t.userA, { profileId: ana.value.id, bookmakerId: a.value.id });
    expect(await createWallet(t.db, t.userA, { profileId: ana.value.id, bookmakerId: a.value.id })).toEqual({
      ok: false,
      error: 'duplicate',
    });
    if (!rb.ok || !ab.ok || !aa.ok) throw new Error('setup');
    expect(aa.value).toMatchObject({
      txnCount: 0,
      lastTxnDate: null,
      lastImportAt: null,
      profileName: 'Ana',
    });

    await createManualTransaction(t.db, t.userA, {
      walletId: aa.value.id,
      date: d('2026-02-01'),
      type: 'deposit',
      amountCents: 500,
    });
    await createManualTransaction(t.db, t.userA, {
      walletId: aa.value.id,
      date: d('2026-03-09'),
      type: 'withdrawal',
      amountCents: 700,
    });
    const list = await listWallets(t.db, t.userA);
    expect(list.map((w) => `${w.profileName}·${w.bookmakerName}`)).toEqual([
      'Ana·Casa A',
      'Ana·Casa B',
      'Rui·Casa B',
    ]);
    expect(list[0]).toMatchObject({ txnCount: 2, lastTxnDate: '2026-03-09' });
    expect(list[1]).toMatchObject({ txnCount: 0, lastTxnDate: null });
    expect(await walletRefs(t.db, t.userA)).toHaveLength(3);
    expect(await walletRefs(t.db, t.userA)).toContainEqual({
      id: rb.value.id,
      profileId: rui.value.id,
      bookmakerId: b.value.id,
    });
  });

  it('not_found quando perfil ou casa são de outro utilizador ou não existem', async () => {
    const mine = await makeWallet(t.db, t.userA);
    const theirs = await makeWallet(t.db, t.userB);
    expect(
      await createWallet(t.db, t.userA, { profileId: theirs.profileId, bookmakerId: mine.bookmakerId }),
    ).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(
      await createWallet(t.db, t.userA, { profileId: mine.profileId, bookmakerId: theirs.bookmakerId }),
    ).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await createWallet(t.db, t.userA, { profileId: 'x', bookmakerId: 'y' })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('isolamento de listagem, refs e apagar; cascata para transações', async () => {
    const w = await makeWallet(t.db, t.userA);
    await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: d('2026-01-05'),
      type: 'deposit',
      amountCents: 1000,
    });
    expect(await listWallets(t.db, t.userB)).toEqual([]);
    expect(await walletRefs(t.db, t.userB)).toEqual([]);
    expect(await deleteWallet(t.db, t.userB, w.walletId)).toBe(false);
    expect(await deleteWallet(t.db, t.userA, 'nao-existe')).toBe(false);
    expect(await deleteWallet(t.db, t.userA, w.walletId)).toBe(true);
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
  });

  it('apagar um utilizador apaga tudo em cascata', async () => {
    const w = await makeWallet(t.db, t.userA);
    await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: d('2026-01-05'),
      type: 'deposit',
      amountCents: 1000,
    });
    await t.client.execute({ sql: 'delete from user where id = ?', args: [t.userA] });
    for (const table of ['bookmaker', 'profile', 'wallet', 'txn']) {
      const r = await t.client.execute(`select count(*) as n from ${table}`);
      expect(r.rows[0]?.n).toBe(0);
    }
  });
});

describe('settings', () => {
  it('devolve predefinições, atualiza parcialmente e isola utilizadores', async () => {
    expect(await getSettings(t.db, t.userA)).toEqual({ theme: 'system', locale: 'pt-PT' });
    expect(await updateSettings(t.db, t.userA, { theme: 'dark' })).toEqual({
      theme: 'dark',
      locale: 'pt-PT',
    });
    expect(await updateSettings(t.db, t.userA, { locale: 'en' })).toEqual({ theme: 'dark', locale: 'en' });
    expect(await updateSettings(t.db, t.userA, {})).toEqual({ theme: 'dark', locale: 'en' });
    expect(await getSettings(t.db, t.userA)).toEqual({ theme: 'dark', locale: 'en' });
    expect(await getSettings(t.db, t.userB)).toEqual({ theme: 'system', locale: 'pt-PT' });
  });
});

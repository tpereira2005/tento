import { beforeEach, describe, expect, it } from 'vitest';
import type { IsoDate, TxnType } from '../../../core/types';
import { txn } from '../schema';
import { createTestDb, makeWallet } from '../test-utils';
import {
  createManualTransaction,
  deleteTransaction,
  existingForDiff,
  InvalidCursorError,
  listTransactions,
  pageTransactions,
  updateTransaction,
} from '.';

const d = (s: string) => s as IsoDate;

let t: Awaited<ReturnType<typeof createTestDb>>;
let w: Awaited<ReturnType<typeof makeWallet>>;
let w2: Awaited<ReturnType<typeof makeWallet>>;
beforeEach(async () => {
  t = await createTestDb();
  w = await makeWallet(t.db, t.userA, 'Ana', 'Casa A');
  w2 = await makeWallet(t.db, t.userA, 'Rui', 'Casa B');
});

async function add(
  walletId: string,
  date: string,
  type: TxnType,
  amountCents: number,
  note?: string,
  userId = t.userA,
) {
  const r = await createManualTransaction(t.db, userId, {
    walletId,
    date: d(date),
    type,
    amountCents,
    ...(note === undefined ? {} : { note }),
  });
  if (!r.ok) throw new Error(`add falhou: ${r.error}`);
  return r.value;
}

describe('createManualTransaction', () => {
  it('cria com seq = número de transações da conta nesse dia e devolve a vista', async () => {
    const a = await add(w.walletId, '2026-01-05', 'deposit', 1000, '  primeira ');
    const b = await add(w.walletId, '2026-01-05', 'deposit', 2000);
    const c = await add(w.walletId, '2026-01-06', 'withdrawal', 500);
    const other = await add(w2.walletId, '2026-01-05', 'deposit', 300);
    expect([a.seq, b.seq, c.seq, other.seq]).toEqual([0, 1, 0, 0]);
    expect(a).toMatchObject({
      source: 'manual',
      note: 'primeira',
      importBatchId: null,
      profileName: 'Ana',
      bookmakerName: 'Casa A',
      walletId: w.walletId,
    });
    expect(b.note).toBeNull();
    expect(other).toMatchObject({ profileName: 'Rui', bookmakerName: 'Casa B' });
  });

  it('valida montante, data, tipo e nota', async () => {
    const base = { walletId: w.walletId, date: d('2026-01-05'), type: 'deposit' as const, amountCents: 100 };
    for (const bad of [
      { amountCents: 0 },
      { amountCents: -5 },
      { amountCents: 1.5 },
      { amountCents: Number.MAX_SAFE_INTEGER + 2 },
      { amountCents: Number.NaN },
      { date: d('2026-02-30') },
      { date: d('nao-data') },
      { type: 'bonus' as TxnType },
      { note: 'x'.repeat(501) },
    ]) {
      expect(await createManualTransaction(t.db, t.userA, { ...base, ...bad })).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
  });

  it('nota só com espaços fica null; conta inexistente ou de outro utilizador é not_found', async () => {
    expect((await add(w.walletId, '2026-01-05', 'deposit', 100, '   ')).note).toBeNull();
    const base = { date: d('2026-01-05'), type: 'deposit' as const, amountCents: 100 };
    expect(await createManualTransaction(t.db, t.userA, { ...base, walletId: 'x' })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await createManualTransaction(t.db, t.userB, { ...base, walletId: w.walletId })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});

describe('updateTransaction / deleteTransaction', () => {
  it('atualiza campos, reposiciona seq ao mudar de data e limpa a nota', async () => {
    const x = await add(w.walletId, '2026-01-05', 'deposit', 1000, 'nota');
    await add(w.walletId, '2026-01-09', 'deposit', 50);
    await add(w.walletId, '2026-01-09', 'deposit', 60);
    const r = await updateTransaction(t.db, t.userA, x.id, {
      date: d('2026-01-09'),
      type: 'withdrawal',
      amountCents: 1234,
      note: null,
    });
    expect(r.ok && r.value).toMatchObject({
      date: '2026-01-09',
      type: 'withdrawal',
      amountCents: 1234,
      note: null,
      seq: 2,
    });
    const same = await updateTransaction(t.db, t.userA, x.id, { date: d('2026-01-09'), note: 'outra' });
    expect(same.ok && same.value).toMatchObject({ seq: 2, note: 'outra' });
    const empty = await updateTransaction(t.db, t.userA, x.id, {});
    expect(empty.ok && empty.value.note).toBe('outra');
  });

  it('rejeita valores inválidos sem alterar nada', async () => {
    const x = await add(w.walletId, '2026-01-05', 'deposit', 1000);
    for (const patch of [
      { amountCents: 0 },
      { type: 'x' as TxnType },
      { date: d('2026-13-01') },
      { note: 'y'.repeat(501) },
    ]) {
      expect(await updateTransaction(t.db, t.userA, x.id, patch)).toEqual({ ok: false, error: 'invalid' });
    }
    const [row] = await listTransactions(t.db, t.userA);
    expect(row).toMatchObject({ amountCents: 1000, type: 'deposit', date: '2026-01-05' });
  });

  it('isolamento: outro utilizador não atualiza nem apaga', async () => {
    const x = await add(w.walletId, '2026-01-05', 'deposit', 1000);
    expect(await updateTransaction(t.db, t.userB, x.id, { amountCents: 1 })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await updateTransaction(t.db, t.userA, 'nao-existe', { amountCents: 1 })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await deleteTransaction(t.db, t.userB, x.id)).toBe(false);
    expect((await listTransactions(t.db, t.userA))[0]?.amountCents).toBe(1000);
    expect(await deleteTransaction(t.db, t.userA, x.id)).toBe(true);
    expect(await deleteTransaction(t.db, t.userA, x.id)).toBe(false);
  });
});

describe('listTransactions', () => {
  it('ordena por data, conta e seq e aplica filtros', async () => {
    await add(w2.walletId, '2026-01-05', 'deposit', 1);
    await add(w.walletId, '2026-01-05', 'deposit', 2);
    await add(w.walletId, '2026-01-05', 'withdrawal', 3);
    await add(w.walletId, '2026-01-01', 'deposit', 4);
    await add(w.walletId, '2026-02-01', 'deposit', 5);
    const all = await listTransactions(t.db, t.userA);
    expect(all.map((r) => r.date)).toEqual([
      '2026-01-01',
      '2026-01-05',
      '2026-01-05',
      '2026-01-05',
      '2026-02-01',
    ]);
    // dentro do mesmo dia: ordem por walletId, depois seq
    const sameDay = all.filter((r) => r.date === '2026-01-05');
    expect(sameDay.map((r) => r.walletId)).toEqual([...sameDay.map((r) => r.walletId)].sort());
    const ana = sameDay.filter((r) => r.walletId === w.walletId);
    expect(ana.map((r) => r.seq)).toEqual([0, 1]);

    const f = (filter: Parameters<typeof listTransactions>[2]) => listTransactions(t.db, t.userA, filter);
    expect(await f({ walletIds: [w2.walletId] })).toHaveLength(1);
    expect(await f({ profileIds: [w.profileId] })).toHaveLength(4);
    expect(await f({ bookmakerIds: [w2.bookmakerId] })).toHaveLength(1);
    expect(await f({ from: d('2026-01-05'), to: d('2026-01-05') })).toHaveLength(3);
    expect(await f({ from: d('2026-01-06') })).toHaveLength(1);
    expect(await f({ to: d('2026-01-01') })).toHaveLength(1);
    expect(await f({ walletIds: [] })).toEqual([]);
    expect(await f({ walletIds: [w.walletId], profileIds: [w2.profileId] })).toEqual([]);
  });

  it('devolve TODAS as linhas (mais de 1000, sem limite)', async () => {
    const rows = Array.from({ length: 1234 }, (_, i) => ({
      id: `id-${String(i).padStart(5, '0')}`,
      userId: t.userA,
      walletId: w.walletId,
      date: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      type: 'deposit' as const,
      amountCents: i + 1,
      seq: i,
      source: 'csv' as const,
    }));
    for (let i = 0; i < rows.length; i += 300) await t.db.insert(txn).values(rows.slice(i, i + 300));
    const all = await listTransactions(t.db, t.userA);
    expect(all).toHaveLength(1234);
    expect(new Set(all.map((r) => r.id)).size).toBe(1234);
    const dates = all.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
    expect((await pageTransactions(t.db, t.userA, { limit: 200 })).total).toBe(1234);
  });

  it('isolamento: utilizador B não vê nada', async () => {
    await add(w.walletId, '2026-01-05', 'deposit', 1);
    expect(await listTransactions(t.db, t.userB)).toEqual([]);
    expect(await listTransactions(t.db, t.userB, { walletIds: [w.walletId] })).toEqual([]);
    expect(await existingForDiff(t.db, t.userB, w.walletId)).toEqual([]);
  });
});

describe('existingForDiff', () => {
  it('devolve id, data, tipo e montante da conta', async () => {
    const a = await add(w.walletId, '2026-01-05', 'deposit', 100);
    await add(w2.walletId, '2026-01-05', 'deposit', 999);
    expect(await existingForDiff(t.db, t.userA, w.walletId)).toEqual([
      { id: a.id, date: '2026-01-05', type: 'deposit', amountCents: 100 },
    ]);
    expect(await existingForDiff(t.db, t.userA, 'x')).toEqual([]);
  });
});

describe('pageTransactions', () => {
  async function seedMany() {
    // muitas linhas com a mesma data e seq iguais para testar a estabilidade do cursor
    const rows = Array.from({ length: 95 }, (_, i) => ({
      id: `id-${String(i % 40).padStart(3, '0')}-${String(i)}`,
      userId: t.userA,
      walletId: i % 2 === 0 ? w.walletId : w2.walletId,
      date: `2026-03-${String(10 + (i % 4)).padStart(2, '0')}`,
      type: txnTypeFor(i),
      amountCents: 100 + i,
      seq: i % 3,
      source: 'manual' as const,
      note: i % 5 === 0 ? `bónus_${String(i)}%` : null,
    }));
    await t.db.insert(txn).values(rows);
    return rows;
  }

  it('percorre todas as páginas sem repetidos nem falhas, em ordem estável', async () => {
    const rows = await seedMany();
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await pageTransactions(t.db, t.userA, { limit: 10, ...(cursor ? { cursor } : {}) });
      expect(page.total).toBe(95);
      expect(page.items.length).toBeLessThanOrEqual(10);
      seen.push(...page.items.map((i) => i.id));
      pages++;
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    expect(pages).toBe(10);
    expect(seen).toHaveLength(95);
    expect(new Set(seen).size).toBe(95);
    const expected = [...rows]
      .sort(
        (a, b) => b.date.localeCompare(a.date) || b.seq - a.seq || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      )
      .map((r) => r.id);
    expect(seen).toEqual(expected);
  });

  it('filtra por tipo, nota (com % e _ literais), conta e datas; total ignora o cursor', async () => {
    await seedMany();
    const dep = await pageTransactions(t.db, t.userA, { type: 'deposit', limit: 200 });
    expect(dep.total).toBe(dep.items.length);
    expect(dep.items.every((i) => i.type === 'deposit')).toBe(true);

    const search = await pageTransactions(t.db, t.userA, { search: 'bónus_', limit: 200 });
    expect(search.total).toBe(19);
    const pct = await pageTransactions(t.db, t.userA, { search: '0%', limit: 200 });
    expect(pct.items.every((i) => i.note?.includes('0%'))).toBe(true);
    expect(pct.total).toBeGreaterThan(0);
    // "_" não é coringa
    expect((await pageTransactions(t.db, t.userA, { search: 'bónus?' })).total).toBe(0);
    expect((await pageTransactions(t.db, t.userA, { search: '   ' })).total).toBe(95);

    const byWallet = await pageTransactions(t.db, t.userA, {
      filter: { walletIds: [w2.walletId], from: d('2026-03-11'), to: d('2026-03-12') },
      limit: 200,
    });
    expect(byWallet.items.every((i) => i.walletId === w2.walletId && i.profileName === 'Rui')).toBe(true);
    expect(byWallet.items.every((i) => i.date >= '2026-03-11' && i.date <= '2026-03-12')).toBe(true);

    const first = await pageTransactions(t.db, t.userA, { limit: 5 });
    const second = await pageTransactions(t.db, t.userA, { limit: 5, cursor: first.nextCursor ?? '' });
    expect(second.total).toBe(first.total);
  });

  it('limite: predefinido 50, mínimo 1 e máximo 200; sem resultados', async () => {
    await seedMany();
    expect((await pageTransactions(t.db, t.userA)).items).toHaveLength(50);
    expect((await pageTransactions(t.db, t.userA, { limit: 0 })).items).toHaveLength(1);
    expect((await pageTransactions(t.db, t.userA, { limit: 9999 })).items).toHaveLength(95);
    const last = await pageTransactions(t.db, t.userA, { limit: 95 });
    expect(last.nextCursor).toBeNull();
    expect(await pageTransactions(t.db, t.userA, { filter: { walletIds: [] } })).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
  });

  it('cursor inválido lança InvalidCursorError', async () => {
    const bad = [
      '%%%',
      'bm90LWpzb24',
      btoa(JSON.stringify({ a: 1 })),
      btoa(JSON.stringify(['2026-01-01', 'x', 'id'])),
      btoa(JSON.stringify(['2026-01-01', 1, 2])),
    ];
    for (const cursor of bad) {
      await expect(pageTransactions(t.db, t.userA, { cursor })).rejects.toBeInstanceOf(InvalidCursorError);
    }
  });

  it('isolamento: B não pagina nem pesquisa os dados de A, nem com o cursor de A', async () => {
    await seedMany();
    const pageA = await pageTransactions(t.db, t.userA, { limit: 5 });
    const cursorA = pageA.nextCursor ?? '';
    expect(await pageTransactions(t.db, t.userB, { limit: 5 })).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
    expect(await pageTransactions(t.db, t.userB, { cursor: cursorA })).toMatchObject({ items: [], total: 0 });
    expect(await pageTransactions(t.db, t.userB, { search: 'bónus' })).toMatchObject({ total: 0 });
    expect(
      await pageTransactions(t.db, t.userB, { filter: { walletIds: [w.walletId] }, type: 'deposit' }),
    ).toMatchObject({ total: 0 });
  });
});

function txnTypeFor(i: number): TxnType {
  return i % 3 === 0 ? 'withdrawal' : 'deposit';
}

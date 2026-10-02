import { beforeEach, describe, expect, it } from 'vitest';
import type { ParsedRow } from '../../../core/csv';
import type { IsoDate, TxnType } from '../../../core/types';
import { createTestDb, makeWallet } from '../test-utils';
import {
  commitImport,
  createManualTransaction,
  INSERT_CHUNK_ROWS,
  listImports,
  listTransactions,
  listWallets,
  pageTransactions,
  undoImport,
  type CommitImportInput,
} from '.';

const row = (line: number, date: string, type: TxnType, amountCents: number, seq = 0): ParsedRow => ({
  line,
  date: date as IsoDate,
  type,
  amountCents,
  seq,
});

let t: Awaited<ReturnType<typeof createTestDb>>;
let w: Awaited<ReturnType<typeof makeWallet>>;
beforeEach(async () => {
  t = await createTestDb();
  w = await makeWallet(t.db, t.userA);
});

const input = (rows: ParsedRow[], extra: Partial<CommitImportInput> = {}): CommitImportInput => ({
  walletId: w.walletId,
  filename: 'casa-a.csv',
  fileSha256: 'a'.repeat(64),
  rowsTotal: rows.length + 3,
  rowsInvalid: 1,
  rowsDuplicate: 1,
  rowsConflict: 1,
  rows,
  ...extra,
});

describe('commitImport', () => {
  it('grava o lote e as linhas, com contadores e vista', async () => {
    const rows = [row(2, '2026-01-05', 'deposit', 1000), row(3, '2026-01-06', 'withdrawal', 500)];
    const r = await commitImport(t.db, t.userA, input(rows));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      walletId: w.walletId,
      profileName: 'Ana',
      bookmakerName: 'Casa A',
      filename: 'casa-a.csv',
      rowsTotal: 5,
      rowsAdded: 2,
      rowsDuplicate: 1,
      rowsInvalid: 1,
      rowsConflict: 1,
      undoneAt: null,
    });
    expect(r.value.createdAt).toBeInstanceOf(Date);
    const list = await pageTransactions(t.db, t.userA, {});
    expect(list.items.every((i) => i.source === 'csv' && i.importBatchId === r.value.id)).toBe(true);
    const wallet = (await listWallets(t.db, t.userA))[0];
    expect(wallet).toMatchObject({ txnCount: 2, lastTxnDate: '2026-01-06' });
    expect(wallet?.lastImportAt).toBeInstanceOf(Date);
  });

  it('seq continua a contagem existente da conta e data', async () => {
    await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: '2026-01-05' as IsoDate,
      type: 'deposit',
      amountCents: 1,
    });
    await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: '2026-01-05' as IsoDate,
      type: 'deposit',
      amountCents: 2,
    });
    const r = await commitImport(
      t.db,
      t.userA,
      input([
        row(2, '2026-01-05', 'deposit', 10, 0),
        row(3, '2026-01-05', 'withdrawal', 20, 1),
        row(4, '2026-01-07', 'deposit', 30, 0),
      ]),
    );
    expect(r.ok).toBe(true);
    const all = await listTransactions(t.db, t.userA);
    expect(all.filter((x) => x.date === '2026-01-05').map((x) => [x.amountCents, x.seq])).toEqual([
      [1, 0],
      [2, 1],
      [10, 2],
      [20, 3],
    ]);
    expect(all.find((x) => x.date === '2026-01-07')?.seq).toBe(0);
    // segundo import no mesmo dia continua de novo
    await commitImport(t.db, t.userA, input([row(2, '2026-01-05', 'deposit', 99, 0)]));
    const again = await listTransactions(t.db, t.userA, {
      from: '2026-01-05' as IsoDate,
      to: '2026-01-05' as IsoDate,
    });
    expect(again.at(-1)).toMatchObject({ amountCents: 99, seq: 4 });
  });

  it('divide as inserções em blocos de INSERT_CHUNK_ROWS e grava todas as linhas', async () => {
    expect(INSERT_CHUNK_ROWS).toBe(500);
    const n = INSERT_CHUNK_ROWS * 2 + 7;
    const rows = Array.from({ length: n }, (_, i) =>
      row(i + 2, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, 'deposit', i + 1, Math.floor(i / 28)),
    );
    const r = await commitImport(t.db, t.userA, input(rows));
    expect(r.ok && r.value.rowsAdded).toBe(n);
    expect(await listTransactions(t.db, t.userA)).toHaveLength(n);
  });

  it('as linhas gravadas via JSON mantêm todos os campos e tipos', async () => {
    const r = await commitImport(
      t.db,
      t.userA,
      input([row(2, '2026-01-05', 'withdrawal', 12345, 0), row(3, '2026-01-05', 'deposit', 1, 1)]),
    );
    if (!r.ok) throw new Error('import falhou');
    const res = await t.client.execute(
      `select wallet_id, date, type, amount_cents, typeof(amount_cents) k, seq, source, import_batch_id, note,
        created_at, updated_at from txn order by seq`,
    );
    expect(res.rows[0]).toMatchObject({
      wallet_id: w.walletId,
      date: '2026-01-05',
      type: 'withdrawal',
      amount_cents: 12345,
      k: 'integer',
      seq: 0,
      source: 'csv',
      import_batch_id: r.value.id,
      note: null,
    });
    expect(res.rows[1]).toMatchObject({ type: 'deposit', amount_cents: 1, seq: 1 });
    for (const x of res.rows) {
      expect(Math.abs(Number(x.created_at) - Date.now())).toBeLessThan(60_000);
      expect(x.updated_at).toBe(x.created_at);
    }
  });

  it('import vazio cria só o lote', async () => {
    const r = await commitImport(t.db, t.userA, input([]));
    expect(r.ok && r.value.rowsAdded).toBe(0);
    expect(await listImports(t.db, t.userA)).toHaveLength(1);
  });

  it('é atómico: uma linha inválida no último bloco não deixa nada gravado', async () => {
    const rows = Array.from({ length: INSERT_CHUNK_ROWS + 5 }, (_, i) =>
      row(i + 2, '2026-01-05', 'deposit', i + 1, i),
    );
    // viola CHECK (amount > 0) no último bloco
    rows[rows.length - 1] = row(999, '2026-01-05', 'deposit', 0, 999);
    await expect(commitImport(t.db, t.userA, input(rows))).rejects.toThrow();
    expect(await listImports(t.db, t.userA)).toEqual([]);
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
    const counts = await t.client.execute(
      'select (select count(*) from import_batch) b, (select count(*) from txn) t',
    );
    expect(counts.rows[0]).toMatchObject({ b: 0, t: 0 });
    // a base continua utilizável
    expect((await commitImport(t.db, t.userA, input([row(2, '2026-01-05', 'deposit', 5)]))).ok).toBe(true);
  });

  it('not_found para conta inexistente ou de outro utilizador (nada é gravado)', async () => {
    const rows = [row(2, '2026-01-05', 'deposit', 1000)];
    expect(await commitImport(t.db, t.userA, input(rows, { walletId: 'x' }))).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await commitImport(t.db, t.userB, input(rows))).toEqual({ ok: false, error: 'not_found' });
    expect(await listImports(t.db, t.userA)).toEqual([]);
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
  });
});

describe('listImports', () => {
  it('ordena do mais recente para o mais antigo e isola utilizadores', async () => {
    const first = await commitImport(
      t.db,
      t.userA,
      input([row(2, '2026-01-05', 'deposit', 1)], { filename: '1.csv' }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const second = await commitImport(
      t.db,
      t.userA,
      input([row(2, '2026-01-06', 'deposit', 1)], { filename: '2.csv' }),
    );
    if (!first.ok || !second.ok) throw new Error('setup');
    expect((await listImports(t.db, t.userA)).map((i) => i.filename)).toEqual(['2.csv', '1.csv']);
    expect(await listImports(t.db, t.userB)).toEqual([]);
  });
});

describe('undoImport', () => {
  it('apaga as linhas do lote (não as outras), marca-o desfeito e depois devolve already_undone', async () => {
    const manual = await createManualTransaction(t.db, t.userA, {
      walletId: w.walletId,
      date: '2026-01-05' as IsoDate,
      type: 'deposit',
      amountCents: 7,
    });
    const b1 = await commitImport(
      t.db,
      t.userA,
      input([row(2, '2026-01-05', 'deposit', 1), row(3, '2026-01-06', 'deposit', 2)]),
    );
    const b2 = await commitImport(t.db, t.userA, input([row(2, '2026-01-09', 'withdrawal', 3)]));
    if (!manual.ok || !b1.ok || !b2.ok) throw new Error('setup');

    const undone = await undoImport(t.db, t.userA, b1.value.id);
    expect(undone.ok && undone.value.undoneAt).toBeInstanceOf(Date);
    const left = await listTransactions(t.db, t.userA);
    expect(left.map((x) => x.amountCents).sort()).toEqual([3, 7]);
    expect(await undoImport(t.db, t.userA, b1.value.id)).toEqual({ ok: false, error: 'already_undone' });
    // a lista mantém o lote desfeito; lastImportAt ignora-o
    expect((await listImports(t.db, t.userA)).find((i) => i.id === b1.value.id)?.undoneAt).toBeInstanceOf(
      Date,
    );
    expect((await listWallets(t.db, t.userA))[0]?.lastImportAt).toEqual(b2.value.createdAt);
    await undoImport(t.db, t.userA, b2.value.id);
    expect((await listWallets(t.db, t.userA))[0]?.lastImportAt).toBeNull();
  });

  it('isolamento: B não desfaz imports de A; inexistente é not_found', async () => {
    const b = await commitImport(t.db, t.userA, input([row(2, '2026-01-05', 'deposit', 1)]));
    if (!b.ok) throw new Error('setup');
    expect(await undoImport(t.db, t.userB, b.value.id)).toEqual({ ok: false, error: 'not_found' });
    expect(await undoImport(t.db, t.userA, 'x')).toEqual({ ok: false, error: 'not_found' });
    expect(await listTransactions(t.db, t.userA)).toHaveLength(1);
    expect((await listImports(t.db, t.userA))[0]?.undoneAt).toBeNull();
  });

  it('apagar a conta apaga os imports em cascata', async () => {
    await commitImport(t.db, t.userA, input([row(2, '2026-01-05', 'deposit', 1)]));
    await t.client.execute({ sql: 'delete from wallet where id = ?', args: [w.walletId] });
    expect(await listImports(t.db, t.userA)).toEqual([]);
    expect(await listTransactions(t.db, t.userA)).toEqual([]);
  });
});

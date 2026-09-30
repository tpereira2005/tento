import { describe, expect, it } from 'vitest';
import { createCatalog, createTestApp, type TestClient } from '../test-app';

interface Preview {
  meta: { totalDataLines: number };
  counts: {
    total: number;
    valid: number;
    invalid: number;
    toAdd: number;
    duplicates: number;
    conflicts: number;
    missingFromFile: number;
  };
  issues: { line: number; code: string }[];
  issuesTotal: number;
  conflicts: {
    incoming: { line: number; amountCents: number };
    existing: { id: string; amountCents: number };
  }[];
  toAddSample: unknown[];
}
interface Batch {
  id: string;
  rowsTotal: number;
  rowsAdded: number;
  rowsDuplicate: number;
  rowsInvalid: number;
  rowsConflict: number;
  undoneAt: string | null;
}
interface Err {
  error: { code: string; details?: unknown };
}

const CSV =
  'Date;Type;Amount\n2026-01-05;Deposit;50,00\n2026-01-10;Withdrawal;20,00\n2026-02-01;Deposit;30,00\n';

const body = (walletId: string, csv: string, filename = 'ana-casa-a.csv') => ({ walletId, filename, csv });
const total = async (a: TestClient) =>
  (await a.json<{ total: number }>('GET', '/api/transactions')).body.total;

describe('/api/imports', () => {
  it('pré-visualiza sem gravar nada', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    const badCsv = `${CSV}data-errada;Deposit;10\n`;

    const res = await a.json<Preview>('POST', '/api/imports/preview', body(walletId, badCsv));
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({
      total: 4,
      valid: 3,
      invalid: 1,
      toAdd: 3,
      duplicates: 0,
      conflicts: 0,
      missingFromFile: 0,
    });
    expect(res.body.issuesTotal).toBe(1);
    expect(res.body.issues[0]).toMatchObject({ line: 5, code: 'invalid_date' });
    expect(res.body.toAddSample).toHaveLength(3);
    expect(await total(a)).toBe(0);
  });

  it('importa, reimporta sem duplicar, reporta conflitos e desfaz', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);

    const first = await a.json<Batch>('POST', '/api/imports', body(walletId, CSV));
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ rowsTotal: 3, rowsAdded: 3, rowsDuplicate: 0, rowsConflict: 0 });
    expect(await total(a)).toBe(3);

    // o mesmo ficheiro outra vez: tudo duplicado, nada novo
    const preview = await a.json<Preview>('POST', '/api/imports/preview', body(walletId, CSV));
    expect(preview.body.counts).toMatchObject({ toAdd: 0, duplicates: 3, conflicts: 0 });
    const again = await a.json<Batch>('POST', '/api/imports', body(walletId, CSV));
    expect(again.body).toMatchObject({ rowsAdded: 0, rowsDuplicate: 3 });
    expect(await total(a)).toBe(3);

    // um valor editado: 1 conflito, e esse não é importado
    const edited = CSV.replace('50,00', '55,00');
    const p2 = await a.json<Preview>('POST', '/api/imports/preview', body(walletId, edited));
    expect(p2.body.counts).toMatchObject({ toAdd: 0, duplicates: 2, conflicts: 1 });
    expect(p2.body.conflicts[0]).toMatchObject({
      incoming: { line: 2, amountCents: 5500 },
      existing: { amountCents: 5000 },
    });
    const c = await a.json<Batch>('POST', '/api/imports', body(walletId, edited));
    expect(c.body).toMatchObject({ rowsAdded: 0, rowsConflict: 1, rowsDuplicate: 2 });
    expect(await total(a)).toBe(3);

    // linhas em falta no ficheiro são apenas reportadas
    const partial = await a.json<Preview>(
      'POST',
      '/api/imports/preview',
      body(walletId, 'Date;Type;Amount\n2026-01-05;Deposit;50,00\n'),
    );
    expect(partial.body.counts).toMatchObject({ duplicates: 1, missingFromFile: 2 });

    // desfazer o primeiro import restaura o estado anterior
    const undone = await a.json<Batch>('POST', `/api/imports/${first.body.id}/undo`);
    expect(undone.status).toBe(200);
    expect(undone.body.undoneAt).toBeTruthy();
    expect(await total(a)).toBe(0);
    const twice = await a.json<Err>('POST', `/api/imports/${first.body.id}/undo`);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('already_undone');

    const list = await a.json<{ items: Batch[] }>('GET', '/api/imports');
    expect(list.body.items).toHaveLength(3);
  });

  it('erros fatais do CSV dão 422 com o código', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    const cases: [string, string][] = [
      ['\n\n  \n', 'empty'],
      ['foo;bar;baz\n1;2;3\n', 'no_header'],
      ['Date;Type\n2026-01-01;Deposit\n', 'missing_columns'],
    ];
    for (const [csv, code] of cases) {
      for (const path of ['/api/imports/preview', '/api/imports']) {
        const res = await a.json<Err>('POST', path, body(walletId, csv));
        expect(res.status, `${path} ${code}`).toBe(422);
        expect(res.body.error.code).toBe(code);
      }
    }
    expect(await total(a)).toBe(0);
  });

  it('valida o corpo e a conta', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    expect((await a.json('POST', '/api/imports/preview', { walletId })).status).toBe(422);
    expect((await a.json('POST', '/api/imports', body(walletId, ''))).status).toBe(422);
    expect((await a.json('POST', '/api/imports', body('nao-existe', CSV))).status).toBe(404);
    expect((await a.json('POST', '/api/imports/preview', body('nao-existe', CSV))).status).toBe(404);
    expect((await a.json('POST', '/api/imports/nao-existe/undo')).status).toBe(404);
  });

  it('importa mais de 1000 linhas e as estatísticas devolvem todas', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    const lines = ['Date;Type;Amount'];
    for (let i = 0; i < 1500; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = String((i % 12) + 1).padStart(2, '0');
      lines.push(`2025-${month}-${day};Deposit;1,00`);
    }
    const res = await a.json<Batch>('POST', '/api/imports', body(walletId, lines.join('\n')));
    expect(res.status).toBe(201);
    expect(res.body.rowsAdded).toBe(1500);
    expect(await total(a)).toBe(1500);
    const dash = await a.json<{ summary: { depositCount: number; depositedCents: number } }>(
      'GET',
      '/api/stats/dashboard',
    );
    expect(dash.body.summary).toMatchObject({ depositCount: 1500, depositedCents: 150_000 });
  });

  it('limita o tamanho de issues e conflitos na pré-visualização', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    const lines = ['Date;Type;Amount'];
    for (let i = 0; i < 250; i++) lines.push(`errada-${i};Deposit;1,00`);
    const res = await a.json<Preview>('POST', '/api/imports/preview', body(walletId, lines.join('\n')));
    expect(res.body.issuesTotal).toBe(250);
    expect(res.body.issues).toHaveLength(200);
    expect(res.body.counts.invalid).toBe(250);

    const existing = ['Date;Type;Amount'];
    const changed = ['Date;Type;Amount'];
    for (let i = 0; i < 120; i++) {
      const date = `2025-01-${String((i % 28) + 1).padStart(2, '0')}`;
      const m = `2025-${String(Math.floor(i / 28) + 1).padStart(2, '0')}`;
      existing.push(`${m}${date.slice(7)};Deposit;1,00`);
      changed.push(`${m}${date.slice(7)};Deposit;2,00`);
    }
    await a.json('POST', '/api/imports', body(walletId, existing.join('\n')));
    const conflicts = await a.json<Preview>(
      'POST',
      '/api/imports/preview',
      body(walletId, changed.join('\n')),
    );
    expect(conflicts.body.counts.conflicts).toBe(120);
    expect(conflicts.body.conflicts).toHaveLength(100);
  });

  it('isolamento: outro utilizador não importa para a conta, nem vê ou desfaz imports', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    const { walletId } = await createCatalog(a);
    const batch = await a.json<Batch>('POST', '/api/imports', body(walletId, CSV));

    expect((await b.json('POST', '/api/imports/preview', body(walletId, CSV))).status).toBe(404);
    expect((await b.json('POST', '/api/imports', body(walletId, CSV))).status).toBe(404);
    expect((await b.json<{ items: unknown[] }>('GET', '/api/imports')).body.items).toEqual([]);
    expect((await b.json('POST', `/api/imports/${batch.body.id}/undo`)).status).toBe(404);
    expect(await total(a)).toBe(3);
    expect(await total(b)).toBe(0);
  });
});

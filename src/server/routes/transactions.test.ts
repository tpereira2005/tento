import { describe, expect, it } from 'vitest';
import { createCatalog, createTestApp } from '../test-app';

interface Txn {
  id: string;
  walletId: string;
  date: string;
  type: string;
  amountCents: number;
  note: string | null;
  source: string;
}
interface Page {
  items: Txn[];
  nextCursor: string | null;
  total: number;
}

const newTxn = (walletId: string, over: Record<string, unknown> = {}) => ({
  walletId,
  date: '2026-03-10',
  type: 'deposit',
  amountCents: 2500,
  ...over,
});

describe('/api/transactions', () => {
  it('cria, lista, altera e apaga', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);

    const created = await a.json<Txn>('POST', '/api/transactions', newTxn(walletId, { note: 'teste' }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ amountCents: 2500, source: 'manual', note: 'teste' });

    const list = await a.json<Page>('GET', '/api/transactions');
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]?.id).toBe(created.body.id);

    const patched = await a.json<Txn>('PATCH', `/api/transactions/${created.body.id}`, {
      amountCents: 3000,
      type: 'withdrawal',
      note: null,
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ amountCents: 3000, type: 'withdrawal', note: null });

    expect((await a.req('DELETE', `/api/transactions/${created.body.id}`)).status).toBe(204);
    expect((await a.req('DELETE', `/api/transactions/${created.body.id}`)).status).toBe(404);
    expect((await a.json<Page>('GET', '/api/transactions')).body.total).toBe(0);
  });

  it('valida datas, valores e tipos', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { walletId } = await createCatalog(a);
    const bad = [
      { date: '2026-02-30' },
      { date: '10/03/2026' },
      { amountCents: 0 },
      { amountCents: -5 },
      { amountCents: 12.5 },
      { type: 'bonus' },
      { note: 'x'.repeat(501) },
    ];
    for (const over of bad) {
      const res = await a.json('POST', '/api/transactions', newTxn(walletId, over));
      expect(res.status, JSON.stringify(over)).toBe(422);
    }
    const ok = await a.json<Txn>('POST', '/api/transactions', newTxn(walletId));
    expect((await a.json('PATCH', `/api/transactions/${ok.body.id}`, {})).status).toBe(422);
    expect((await a.json('PATCH', `/api/transactions/${ok.body.id}`, { date: '2026-13-01' })).status).toBe(
      422,
    );
    const unknown = await a.json('POST', '/api/transactions', newTxn('nao-existe'));
    expect(unknown.status).toBe(404);
    expect((await a.json('PATCH', '/api/transactions/nao-existe', { amountCents: 5 })).status).toBe(404);
  });

  it('filtra, pesquisa e pagina com cursor', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const c1 = await createCatalog(a);
    const c2 = await createCatalog(a, 'Rui', 'Casa B');
    for (let i = 1; i <= 5; i++) {
      await a.json(
        'POST',
        '/api/transactions',
        newTxn(c1.walletId, { date: `2026-01-0${i}`, note: i === 3 ? 'bónus' : undefined }),
      );
    }
    await a.json(
      'POST',
      '/api/transactions',
      newTxn(c2.walletId, { type: 'withdrawal', date: '2026-02-01' }),
    );

    const p1 = await a.json<Page>('GET', '/api/transactions?limit=4');
    expect(p1.body.items).toHaveLength(4);
    expect(p1.body.total).toBe(6);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await a.json<Page>('GET', `/api/transactions?limit=4&cursor=${p1.body.nextCursor ?? ''}`);
    expect(p2.body.items).toHaveLength(2);
    expect(p2.body.nextCursor).toBeNull();

    const byWallet = await a.json<Page>('GET', `/api/transactions?walletIds=${c2.walletId}`);
    expect(byWallet.body.total).toBe(1);
    const byProfile = await a.json<Page>('GET', `/api/transactions?profileIds=${c1.profileId}`);
    expect(byProfile.body.total).toBe(5);
    const byBook = await a.json<Page>(
      'GET',
      `/api/transactions?bookmakerIds=${c2.bookmakerId},${c1.bookmakerId}`,
    );
    expect(byBook.body.total).toBe(6);
    const range = await a.json<Page>('GET', '/api/transactions?from=2026-01-02&to=2026-01-04');
    expect(range.body.total).toBe(3);
    const type = await a.json<Page>('GET', '/api/transactions?type=withdrawal');
    expect(type.body.total).toBe(1);
    const search = await a.json<Page>('GET', '/api/transactions?q=b%C3%B3nus');
    expect(search.body.total).toBe(1);

    expect((await a.json('GET', '/api/transactions?from=ontem')).status).toBe(422);
    expect((await a.json('GET', '/api/transactions?limit=0')).status).toBe(422);
    expect((await a.json('GET', '/api/transactions?type=x')).status).toBe(422);
    const badCursor = await a.json<{ error: { code: string } }>('GET', '/api/transactions?cursor=lixo');
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.error.code).toBe('invalid_cursor');
  });

  it('isolamento: outro utilizador não lê, cria, altera nem apaga', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    const mine = await createCatalog(a);
    const tx = await a.json<Txn>('POST', '/api/transactions', newTxn(mine.walletId));

    const list = await b.json<Page>('GET', '/api/transactions');
    expect(list.body).toMatchObject({ items: [], total: 0 });
    const filtered = await b.json<Page>('GET', `/api/transactions?walletIds=${mine.walletId}`);
    expect(filtered.body.total).toBe(0);
    expect((await b.json('POST', '/api/transactions', newTxn(mine.walletId))).status).toBe(404);
    expect((await b.json('PATCH', `/api/transactions/${tx.body.id}`, { amountCents: 1 })).status).toBe(404);
    expect((await b.req('DELETE', `/api/transactions/${tx.body.id}`)).status).toBe(404);

    const still = await a.json<Page>('GET', '/api/transactions');
    expect(still.body.items[0]).toMatchObject({ id: tx.body.id, amountCents: 2500 });
  });
});

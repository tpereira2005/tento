import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  account,
  bookmaker,
  importBatch,
  profile,
  session,
  txn,
  user,
  userSettings,
  wallet,
} from '../db/schema';
import { createCatalog, createTestApp, TEST_PASSWORD, type TestApp, type TestClient } from '../test-app';

interface Exported {
  format: string;
  version: number;
  exportedAt: string;
  user: { name: string; email: string };
  settings: { theme: string; locale: string };
  profiles: { id: string }[];
  bookmakers: { id: string }[];
  wallets: { id: string }[];
  imports: unknown[];
  transactions: { amountCents: number; walletId: string }[];
}

async function seed(a: TestClient, profileName = 'Ana', bookmakerName = 'Casa A') {
  const mine = await createCatalog(a, profileName, bookmakerName);
  for (const amountCents of [1000, 2500]) {
    const res = await a.json('POST', '/api/transactions', {
      walletId: mine.walletId,
      date: '2026-03-10',
      type: 'deposit',
      amountCents,
    });
    expect(res.status).toBe(201);
  }
  await a.json('PATCH', '/api/me/settings', { theme: 'dark' });
  return mine;
}

const EMPTY = { txn: 0, importBatch: 0, wallet: 0, profile: 0, bookmaker: 0, userSettings: 0 };

/** Linhas de cada tabela de domínio pertencentes a `userId`, lidas diretamente da BD. */
async function domainRows(t: TestApp, userId: string) {
  const tables = { txn, importBatch, wallet, profile, bookmaker, userSettings };
  const out: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    const rows = await t.db.select({ n: count() }).from(table).where(eq(table.userId, userId));
    out[name] = rows[0]?.n ?? 0;
  }
  return out;
}

describe('GET /api/me/export', () => {
  it('exporta tudo em JSON, como descarregamento, sem segredos', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test', 'Ana');
    const mine = await seed(a);

    const res = await a.req('GET', '/api/me/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="tento-dados-2026-06-15.json"');
    expect(res.headers.get('content-type')).toContain('application/json');
    const text = await res.text();
    const body = JSON.parse(text) as Exported;
    expect(body).toMatchObject({
      format: 'tento-export',
      version: 1,
      exportedAt: '2026-06-15T12:00:00.000Z',
      user: { name: 'Ana', email: 'ana@exemplo.test' },
      settings: { theme: 'dark' },
    });
    expect(body.profiles).toHaveLength(1);
    expect(body.bookmakers).toHaveLength(1);
    expect(body.wallets).toEqual([expect.objectContaining({ id: mine.walletId })]);
    expect(body.transactions.map((x) => x.amountCents).sort()).toEqual([1000, 2500]);
    // nada de autenticação
    expect(text).not.toContain(TEST_PASSWORD);
    expect(text).not.toMatch(/"(password|token|hash|accessToken)"/i);
    expect(Object.keys(body)).not.toContain('sessions');
  });

  it('exige sessão', async () => {
    const t = await createTestApp();
    expect((await t.raw('GET', '/api/me/export')).status).toBe(401);
  });

  it('isolamento: só exporta os dados do próprio utilizador', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test', 'Rui');
    await seed(a);

    const res = await b.json<Exported>('GET', '/api/me/export');
    expect(res.body.user.email).toBe('rui@exemplo.test');
    expect(res.body).toMatchObject({
      profiles: [],
      bookmakers: [],
      wallets: [],
      imports: [],
      transactions: [],
    });
  });
});

describe('DELETE /api/me/data', () => {
  it('apaga mesmo todos os dados do utilizador (verificado na BD) e mantém a conta', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    await seed(a);
    expect(await domainRows(t, a.userId)).toEqual({
      ...EMPTY,
      txn: 2,
      wallet: 1,
      profile: 1,
      bookmaker: 1,
      userSettings: 1,
    });

    const res = await a.req('DELETE', '/api/me/data', { confirm: 'APAGAR' });
    expect(res.status).toBe(204);

    expect(await domainRows(t, a.userId)).toEqual(EMPTY);
    // a conta e a sessão continuam
    expect(await t.db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(1);
    const me = await a.json<{ settings: { theme: string } }>('GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.body.settings.theme).toBe('system');
    expect((await a.json<{ items: unknown[] }>('GET', '/api/transactions')).body.items).toEqual([]);
  });

  it('exige a confirmação exata', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    await seed(a);
    for (const body of [undefined, {}, { confirm: 'apagar' }, { confirm: 'sim' }]) {
      const res = await a.req('DELETE', '/api/me/data', body);
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    expect((await domainRows(t, a.userId)).txn).toBe(2);
  });

  it('exige sessão', async () => {
    const t = await createTestApp();
    expect((await t.raw('DELETE', '/api/me/data', { confirm: 'APAGAR' })).status).toBe(401);
  });

  it('isolamento: apagar os dados de um utilizador não toca nos de outro', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    await seed(a);
    await seed(b, 'Rui', 'Casa B');

    expect((await b.req('DELETE', '/api/me/data', { confirm: 'APAGAR' })).status).toBe(204);
    expect(await domainRows(t, b.userId)).toEqual(EMPTY);
    expect(await domainRows(t, a.userId)).toMatchObject({ txn: 2, wallet: 1, profile: 1, bookmaker: 1 });
    expect((await a.json<{ total: number }>('GET', '/api/transactions')).body.total).toBe(2);
  });
});

describe('DELETE /api/me', () => {
  it('recusa palavra-passe incorreta e não apaga nada', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    await seed(a);
    const res = await a.json<{ error: { code: string } }>('DELETE', '/api/me', {
      password: 'errada-errada-1',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('invalid_password');
    expect(await t.db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(1);
    expect((await domainRows(t, a.userId)).txn).toBe(2);
    expect((await a.req('GET', '/api/me')).status).toBe(200);
  });

  it('exige a palavra-passe no corpo', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    expect((await a.req('DELETE', '/api/me', {})).status).toBe(422);
  });

  it('apaga a conta e tudo o que lhe pertence; a sessão deixa de valer e o registo reabre', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    await seed(a);

    const res = await a.req('DELETE', '/api/me', { password: TEST_PASSWORD });
    expect(res.status).toBe(204);

    expect(await t.db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(0);
    expect(await t.db.select().from(account).where(eq(account.userId, a.userId))).toHaveLength(0);
    expect(await t.db.select().from(session).where(eq(session.userId, a.userId))).toHaveLength(0);
    expect(await domainRows(t, a.userId)).toEqual(EMPTY);
    expect((await a.req('GET', '/api/me')).status).toBe(401);
    // sem utilizadores, o registo volta a abrir (comportamento esperado de uma instância de um só dono)
    expect(await (await t.raw('GET', '/api/setup')).json()).toEqual({ registrationOpen: true });
  });

  it('isolamento: apagar a conta de um utilizador não afeta o outro', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    await seed(a);
    await seed(b, 'Rui', 'Casa B');

    // a palavra-passe de teste é a mesma para ambos; a sessão de B só pode apagar B
    expect((await b.req('DELETE', '/api/me', { password: TEST_PASSWORD })).status).toBe(204);
    expect(await t.db.select().from(user).where(eq(user.id, b.userId))).toHaveLength(0);
    expect(await t.db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(1);
    expect(await domainRows(t, b.userId)).toEqual(EMPTY);
    expect(await domainRows(t, a.userId)).toMatchObject({ txn: 2, wallet: 1 });
    expect((await a.req('GET', '/api/me')).status).toBe(200);
  });
});

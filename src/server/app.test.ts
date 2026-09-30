import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';
import { createTestApp, TEST_ORIGIN, TEST_PASSWORD } from './test-app';

describe('env', () => {
  const base = { BETTER_AUTH_SECRET: 'x'.repeat(32) };

  it('aplica os valores por omissão', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(8787);
    expect(env.DATABASE_URL).toBe('file:./data/tento.db');
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:5173');
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejeita segredo curto ou em falta, sem mostrar o valor', () => {
    expect(() => loadEnv({ BETTER_AUTH_SECRET: 'curto' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv({})).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv({ BETTER_AUTH_SECRET: 'curto' })).not.toThrow(/curto'/);
  });

  it('lê a porta como número', () => {
    expect(loadEnv({ ...base, PORT: '9000' }).PORT).toBe(9000);
  });
});

describe('autenticação e registo', () => {
  it('GET /api/setup é público e reflete o estado do registo', async () => {
    const t = await createTestApp();
    const before = await t.raw('GET', '/api/setup');
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual({ registrationOpen: true });

    await t.signUp('ana@exemplo.test');
    const after = await t.raw('GET', '/api/setup');
    expect(await after.json()).toEqual({ registrationOpen: false });
  });

  it('o registo fecha depois do primeiro utilizador', async () => {
    const t = await createTestApp();
    await t.signUp('ana@exemplo.test');
    const res = await t.raw('POST', '/api/auth/sign-up/email', {
      email: 'rui@exemplo.test',
      name: 'Rui',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'registration_closed' });
  });

  it('com registo aberto, /api/setup mantém-se aberto', async () => {
    const t = await createTestApp('open');
    await t.signUp('a@exemplo.test');
    await t.signUp('b@exemplo.test');
    expect(await (await t.raw('GET', '/api/setup')).json()).toEqual({ registrationOpen: true });
  });

  it('rejeita palavras-passe com menos de 12 caracteres', async () => {
    const t = await createTestApp();
    const res = await t.raw('POST', '/api/auth/sign-up/email', {
      email: 'ana@exemplo.test',
      name: 'Ana',
      password: 'curta-demai',
    });
    expect(res.status).toBe(400);
  });

  it('inicia sessão com as credenciais certas e recusa as erradas', async () => {
    const t = await createTestApp();
    await t.signUp('ana@exemplo.test');
    const bad = await t.raw('POST', '/api/auth/sign-in/email', {
      email: 'ana@exemplo.test',
      password: 'palavra-passe-errada',
    });
    expect(bad.status).toBe(401);
    const good = await t.raw('POST', '/api/auth/sign-in/email', {
      email: 'ana@exemplo.test',
      password: TEST_PASSWORD,
    });
    expect(good.status).toBe(200);
    const cookie = good.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    expect(cookie).toContain('tento.session_token');
    const me = await t.raw('GET', '/api/me', undefined, { headers: { cookie } });
    expect(me.status).toBe(200);
  });

  it('o cookie de sessão é HttpOnly, SameSite e tem o prefixo "tento"', async () => {
    const t = await createTestApp();
    const res = await t.raw('POST', '/api/auth/sign-up/email', {
      email: 'ana@exemplo.test',
      name: 'Ana',
      password: TEST_PASSWORD,
    });
    const session = res.headers.getSetCookie().find((c) => c.startsWith('tento.session_token'));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
  });
});

describe('proteções transversais', () => {
  it('401 sem sessão em todas as rotas protegidas', async () => {
    const t = await createTestApp();
    const routes: [string, string][] = [
      ['GET', '/api/me'],
      ['PATCH', '/api/me/settings'],
      ['GET', '/api/bookmakers'],
      ['POST', '/api/bookmakers'],
      ['PATCH', '/api/bookmakers/x'],
      ['DELETE', '/api/bookmakers/x'],
      ['GET', '/api/profiles'],
      ['POST', '/api/profiles'],
      ['PATCH', '/api/profiles/x'],
      ['DELETE', '/api/profiles/x'],
      ['GET', '/api/wallets'],
      ['POST', '/api/wallets'],
      ['DELETE', '/api/wallets/x'],
      ['GET', '/api/transactions'],
      ['POST', '/api/transactions'],
      ['PATCH', '/api/transactions/x'],
      ['DELETE', '/api/transactions/x'],
      ['POST', '/api/imports/preview'],
      ['POST', '/api/imports'],
      ['GET', '/api/imports'],
      ['POST', '/api/imports/x/undo'],
      ['GET', '/api/stats/dashboard'],
    ];
    for (const [method, path] of routes) {
      const res = await t.raw(method, path, method === 'GET' ? undefined : {});
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(await res.json()).toMatchObject({ error: { code: 'unauthenticated' } });
    }
  });

  it('o CSRF rejeita POST de outra origem (ou sem origem)', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const cross = await a.req(
      'POST',
      '/api/bookmakers',
      { name: 'Casa A' },
      { headers: { origin: 'https://mau.example' } },
    );
    expect(cross.status).toBe(403);
    expect(await cross.json()).toMatchObject({ error: { code: 'forbidden' } });

    const headers = new Headers({ cookie: a.cookie, 'content-type': 'application/json' });
    const noOrigin = await t.app.request('/api/bookmakers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Casa A' }),
    });
    expect(noOrigin.status).toBe(403);

    const same = await a.req('POST', '/api/bookmakers', { name: 'Casa A' });
    expect(same.status).toBe(201);
    // pedidos de leitura não exigem origem
    const read = await t.app.request('/api/bookmakers', { headers: { cookie: a.cookie } });
    expect(read.status).toBe(200);
  });

  it('envia cabeçalhos de segurança', async () => {
    const t = await createTestApp();
    const res = await t.raw('GET', '/api/setup');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBeTruthy();
    expect(res.headers.get('referrer-policy')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('413 acima de 64 KB fora dos imports e acima de 5 MB nos imports', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const big = await a.req('POST', '/api/bookmakers', { name: 'x'.repeat(70 * 1024) });
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ error: { code: 'payload_too_large' } });

    // 1 MB de CSV passa o limite (a rota responde com outro erro, não 413)
    const mid = await a.req('POST', '/api/imports/preview', {
      walletId: 'w',
      filename: 'a.csv',
      csv: 'x'.repeat(1024 * 1024),
    });
    expect(mid.status).toBe(404);
    const huge = await a.req('POST', '/api/imports/preview', {
      walletId: 'w',
      filename: 'a.csv',
      csv: 'x'.repeat(6 * 1024 * 1024),
    });
    expect(huge.status).toBe(413);
  });

  it('JSON malformado dá 400 e rota desconhecida dá 404 em JSON', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const bad = await a.req('POST', '/api/bookmakers', '{nao-e-json');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'bad_request' } });
    const missing = await a.req('GET', '/api/nao-existe');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } });
  });

  it('o limite de pedidos responde 429 a tentativas repetidas de login', async () => {
    const t = await createTestApp('first-user-only', { enabled: true, window: 60, max: 100 });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await t.raw(
        'POST',
        '/api/auth/sign-in/email',
        { email: 'x@exemplo.test', password: 'palavra-passe-errada' },
        { headers: { 'x-forwarded-for': '203.0.113.9' } },
      );
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });

  it('a origem da aplicação é a do baseURL', () => {
    expect(TEST_ORIGIN).toBe('http://localhost:5173');
  });
});

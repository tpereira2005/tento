import { describe, expect, it } from 'vitest';
import { createCatalog, createTestApp } from '../test-app';

interface Named {
  id: string;
  name: string;
}
interface List<T> {
  items: T[];
}

describe.each([
  ['bookmakers', 'Casa A', 'Casa B'],
  ['profiles', 'Ana', 'Rui'],
] as const)('/api/%s', (resource, nameA, nameB) => {
  const path = `/api/${resource}`;

  it('cria, lista, renomeia e apaga', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');

    const created = await a.json<Named>('POST', path, { name: nameA });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(nameA);

    expect((await a.json<List<Named>>('GET', path)).body.items.map((i) => i.name)).toEqual([nameA]);

    const renamed = await a.json<Named>('PATCH', `${path}/${created.body.id}`, { name: nameB });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe(nameB);

    expect((await a.req('DELETE', `${path}/${created.body.id}`)).status).toBe(204);
    expect((await a.json<List<Named>>('GET', path)).body.items).toEqual([]);
    expect((await a.req('DELETE', `${path}/${created.body.id}`)).status).toBe(404);
  });

  it('valida o nome e recusa duplicados', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const empty = await a.json<{ error: { code: string; details: unknown[] } }>('POST', path, { name: '  ' });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('validation_error');
    expect(empty.body.error.details.length).toBeGreaterThan(0);

    await a.json('POST', path, { name: nameA });
    const dup = await a.json<{ error: { code: string } }>('POST', path, { name: nameA });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('duplicate');

    const other = await a.json<Named>('POST', path, { name: nameB });
    const clash = await a.json('PATCH', `${path}/${other.body.id}`, { name: nameA });
    expect(clash.status).toBe(409);
  });

  it('isolamento: outro utilizador não vê, renomeia nem apaga', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    const mine = await a.json<Named>('POST', path, { name: nameA });

    expect((await b.json<List<Named>>('GET', path)).body.items).toEqual([]);
    expect((await b.json('PATCH', `${path}/${mine.body.id}`, { name: nameB })).status).toBe(404);
    expect((await b.req('DELETE', `${path}/${mine.body.id}`)).status).toBe(404);
    // continua intacto para o dono
    expect((await a.json<List<Named>>('GET', path)).body.items.map((i) => i.name)).toEqual([nameA]);
    // o mesmo nome é livre para o outro utilizador
    expect((await b.json('POST', path, { name: nameA })).status).toBe(201);
  });
});

describe('/api/wallets', () => {
  it('cria, lista e apaga contas; recusa duplicados', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { bookmakerId, profileId, walletId } = await createCatalog(a);

    const list = await a.json<List<{ id: string }>>('GET', '/api/wallets');
    expect(list.body.items.map((w) => w.id)).toEqual([walletId]);

    const dup = await a.json('POST', '/api/wallets', { profileId, bookmakerId });
    expect(dup.status).toBe(409);
    const missing = await a.json('POST', '/api/wallets', { profileId: 'nao-existe', bookmakerId });
    expect(missing.status).toBe(404);
    expect((await a.json('POST', '/api/wallets', { profileId })).status).toBe(422);

    expect((await a.req('DELETE', `/api/wallets/${walletId}`)).status).toBe(204);
    expect((await a.req('DELETE', `/api/wallets/${walletId}`)).status).toBe(404);
  });

  it('apagar uma casa apaga as suas contas', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    const { bookmakerId } = await createCatalog(a);
    await a.req('DELETE', `/api/bookmakers/${bookmakerId}`);
    expect((await a.json<List<unknown>>('GET', '/api/wallets')).body.items).toEqual([]);
  });

  it('isolamento: outro utilizador não vê nem apaga contas, nem liga ids alheios', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    const mine = await createCatalog(a);

    expect((await b.json<List<unknown>>('GET', '/api/wallets')).body.items).toEqual([]);
    expect((await b.req('DELETE', `/api/wallets/${mine.walletId}`)).status).toBe(404);
    const bk = await b.json<Named>('POST', '/api/bookmakers', { name: 'Casa B' });
    const link = await b.json('POST', '/api/wallets', { profileId: mine.profileId, bookmakerId: bk.body.id });
    expect(link.status).toBe(404);
    expect((await a.json<List<unknown>>('GET', '/api/wallets')).body.items).toHaveLength(1);
  });
});

describe('/api/me', () => {
  it('devolve o utilizador e as definições; PATCH atualiza', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test', 'Ana');
    const me = await a.json<{ user: { id: string; name: string; email: string }; settings: unknown }>(
      'GET',
      '/api/me',
    );
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({ id: a.userId, name: 'Ana', email: 'ana@exemplo.test' });
    expect(me.body.settings).toEqual({ theme: 'system', locale: 'pt-PT' });

    const patched = await a.json('PATCH', '/api/me/settings', { theme: 'dark' });
    expect(patched.body).toEqual({ theme: 'dark', locale: 'pt-PT' });
    expect((await a.json<{ settings: unknown }>('GET', '/api/me')).body.settings).toEqual({
      theme: 'dark',
      locale: 'pt-PT',
    });
  });

  it('valida as definições', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    expect((await a.json('PATCH', '/api/me/settings', { theme: 'rosa' })).status).toBe(422);
    expect((await a.json('PATCH', '/api/me/settings', {})).status).toBe(422);
  });

  it('isolamento: as definições são por utilizador', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('ana@exemplo.test');
    const b = await t.signUp('rui@exemplo.test', 'Rui');
    await a.json('PATCH', '/api/me/settings', { theme: 'dark', locale: 'en' });
    const other = await b.json<{ user: { name: string }; settings: unknown }>('GET', '/api/me');
    expect(other.body.user.name).toBe('Rui');
    expect(other.body.settings).toEqual({ theme: 'system', locale: 'pt-PT' });
  });
});

import { Hono } from 'hono';
import { z } from 'zod';
import {
  createBookmaker,
  createProfile,
  createWallet,
  deleteBookmaker,
  deleteProfile,
  deleteWallet,
  listBookmakers,
  listProfiles,
  listWallets,
  renameBookmaker,
  renameProfile,
} from '../db/repos';
import { failure, notFound, validate, type AppEnv } from '../http';

const nameBody = z.object({ name: z.string().trim().min(1).max(60) });
const idParam = z.object({ id: z.string().min(1).max(64) });
const walletBody = z.object({ profileId: z.string().min(1).max(64), bookmakerId: z.string().min(1).max(64) });

/** Casas, perfis e contas: listar, criar, renomear (onde aplicável) e apagar. */
export function catalogRoutes() {
  const app = new Hono<AppEnv>();

  app.get('/bookmakers', async (c) => c.json({ items: await listBookmakers(c.get('db'), c.get('user').id) }));
  app.post('/bookmakers', validate('json', nameBody), async (c) => {
    const r = await createBookmaker(c.get('db'), c.get('user').id, c.req.valid('json'));
    return r.ok ? c.json(r.value, 201) : failure(r.error);
  });
  app.patch('/bookmakers/:id', validate('param', idParam), validate('json', nameBody), async (c) => {
    const r = await renameBookmaker(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return r.ok ? c.json(r.value) : failure(r.error);
  });
  app.delete('/bookmakers/:id', validate('param', idParam), async (c) => {
    const done = await deleteBookmaker(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return done ? c.body(null, 204) : notFound();
  });

  app.get('/profiles', async (c) => c.json({ items: await listProfiles(c.get('db'), c.get('user').id) }));
  app.post('/profiles', validate('json', nameBody), async (c) => {
    const r = await createProfile(c.get('db'), c.get('user').id, c.req.valid('json'));
    return r.ok ? c.json(r.value, 201) : failure(r.error);
  });
  app.patch('/profiles/:id', validate('param', idParam), validate('json', nameBody), async (c) => {
    const r = await renameProfile(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return r.ok ? c.json(r.value) : failure(r.error);
  });
  app.delete('/profiles/:id', validate('param', idParam), async (c) => {
    const done = await deleteProfile(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return done ? c.body(null, 204) : notFound();
  });

  app.get('/wallets', async (c) => c.json({ items: await listWallets(c.get('db'), c.get('user').id) }));
  app.post('/wallets', validate('json', walletBody), async (c) => {
    const r = await createWallet(c.get('db'), c.get('user').id, c.req.valid('json'));
    return r.ok ? c.json(r.value, 201) : failure(r.error);
  });
  app.delete('/wallets/:id', validate('param', idParam), async (c) => {
    const done = await deleteWallet(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return done ? c.body(null, 204) : notFound();
  });

  return app;
}

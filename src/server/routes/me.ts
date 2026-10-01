import { Hono } from 'hono';
import { z } from 'zod';
import type { TentoAuth } from '../auth';
import { deleteUserData, exportUserData, getSettings, updateSettings } from '../db/repos';
import { THEMES } from '../db/schema';
import { apiError, compact, notFound, validate, type AppEnv } from '../http';

const settingsBody = z
  .object({
    theme: z.enum(THEMES).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Indica pelo menos um campo.');

const deleteDataBody = z.object({ confirm: z.literal('APAGAR') });
const deleteAccountBody = z.object({ password: z.string().min(1).max(256) });

export function meRoutes(auth: TentoAuth, now: () => Date = () => new Date()) {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    return c.json({ user, settings: await getSettings(c.get('db'), user.id) });
  });

  app.patch('/settings', validate('json', settingsBody), async (c) => {
    const settings = await updateSettings(c.get('db'), c.get('user').id, compact(c.req.valid('json')));
    return c.json(settings);
  });

  // Exportação de todos os dados do utilizador (JSON, sem segredos de autenticação).
  app.get('/export', async (c) => {
    const user = c.get('user');
    const data = await exportUserData(c.get('db'), user.id, now());
    if (!data) return notFound();
    const day = data.exportedAt.slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="tento-dados-${day}.json"`);
    c.header('Cache-Control', 'no-store');
    return c.json(data);
  });

  // Apaga todos os dados de domínio, mas mantém a conta (o utilizador continua a poder entrar).
  app.delete('/data', validate('json', deleteDataBody), async (c) => {
    await deleteUserData(c.get('db'), c.get('user').id);
    return c.body(null, 204);
  });

  // Apaga a própria conta (a palavra-passe é verificada pelo Better Auth; as tabelas da aplicação
  // desaparecem por ON DELETE CASCADE). Com 0 utilizadores o registo volta a abrir.
  app.delete('/', validate('json', deleteAccountBody), async (c) => {
    const { password } = c.req.valid('json');
    const res = await auth.api.deleteUser({
      headers: c.req.raw.headers,
      body: { password },
      asResponse: true,
    });
    if (!res.ok) return apiError(403, 'invalid_password', 'Palavra-passe incorreta.');
    // inclui o Set-Cookie que termina a sessão no browser
    return new Response(null, { status: 204, headers: res.headers });
  });

  return app;
}

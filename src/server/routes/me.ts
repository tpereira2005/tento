import { Hono } from 'hono';
import { z } from 'zod';
import { getSettings, updateSettings } from '../db/repos';
import { THEMES } from '../db/schema';
import { compact, validate, type AppEnv } from '../http';

const settingsBody = z
  .object({
    theme: z.enum(THEMES).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Indica pelo menos um campo.');

export function meRoutes() {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    return c.json({ user, settings: await getSettings(c.get('db'), user.id) });
  });

  app.patch('/settings', validate('json', settingsBody), async (c) => {
    const settings = await updateSettings(c.get('db'), c.get('user').id, compact(c.req.valid('json')));
    return c.json(settings);
  });

  return app;
}

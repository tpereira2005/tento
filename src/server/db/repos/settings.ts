import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import type { THEMES } from '../schema';
import { userSettings } from '../schema';

export type Theme = (typeof THEMES)[number];

export interface Settings {
  theme: Theme;
  locale: string;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', locale: 'pt-PT' };

export async function getSettings(db: Db, userId: string): Promise<Settings> {
  const rows = await db
    .select({ theme: userSettings.theme, locale: userSettings.locale })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return rows[0] ?? { ...DEFAULT_SETTINGS };
}

/** Atualiza só os campos indicados (cria a linha se ainda não existir). */
export async function updateSettings(db: Db, userId: string, patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings(db, userId);
  const next: Settings = { theme: patch.theme ?? current.theme, locale: patch.locale ?? current.locale };
  await db
    .insert(userSettings)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...next, updatedAt: new Date() } });
  return next;
}

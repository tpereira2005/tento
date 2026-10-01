import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

/** Pasta das capturas de verificação visual: `TENTO_SHOTS_DIR` ou, por omissão, dentro de `test-results/`. */
const SHOTS_DIR = process.env.TENTO_SHOTS_DIR ?? join('test-results', 'shots');

/** Guarda uma captura de página inteira com o nome dado (sem extensão). */
export async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: true });
}

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const AUTH_DIR = 'tests/e2e/.auth';
export const OWNER_STATE_FILE = `${AUTH_DIR}/owner.json`;
export const OWNER_CREDENTIALS_FILE = `${AUTH_DIR}/credentials.json`;

export interface OwnerCredentials {
  name: string;
  email: string;
  password: string;
}

/** Credenciais fictícias do dono, geradas em tempo de execução por auth.setup.ts (ficheiro ignorado pelo git). */
export function readOwner(): OwnerCredentials {
  return JSON.parse(readFileSync(OWNER_CREDENTIALS_FILE, 'utf8')) as OwnerCredentials;
}

/** Entra pela interface (a página tem de ser /entrar). */
export async function signInThroughUi(page: Page, credentials: OwnerCredentials): Promise<void> {
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Página com tema fixo (antes de a aplicação arrancar). */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('tento:tema', value);
  }, theme);
}

/** axe com as etiquetas WCAG 2.0/2.1/2.2 A e AA; falha com qualquer violação. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Entra pela interface e espera pelo destino. O Better Auth limita a entrada a 3 tentativas em 10 s;
 * se isso acontecer, espera a janela passar e tenta de novo.
 */
export async function signInAndWait(
  page: Page,
  credentials: OwnerCredentials,
  target: string | RegExp,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await signInThroughUi(page, credentials);
    try {
      await page.waitForURL(target, { timeout: 5_000 });
      return;
    } catch (error) {
      if (!(await page.getByText('Demasiadas tentativas').isVisible())) throw error;
      await page.waitForTimeout(10_500);
    }
  }
  throw new Error('Não foi possível entrar (limite de tentativas).');
}

/**
 * Regista as violações da política de segurança (CSP) que o browser escreve na consola e como erros
 * de página. Chamar ANTES de navegar; no fim, `expect(violations).toEqual([])`.
 */
export function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  page.on('pageerror', (error) => {
    if (/content security policy/i.test(error.message)) violations.push(error.message);
  });
  return violations;
}

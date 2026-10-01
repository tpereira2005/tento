import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const account = `${name('Ana')} · ${name('Casa A')}`;
const filename = `ana-${tag}.csv`;

/** CSV sintético com 3 linhas válidas, em formatos de valor diferentes. */
const csv = [
  'Date;Tipe;Vaule',
  '2025-01-05;Deposit;20',
  '2025-01-12;Withdrawal;35,50',
  '2025-02-03;Deposit;50,00',
].join('\r\n');

interface Named {
  id: string;
  name: string;
}
interface WalletItem {
  id: string;
  profileName: string;
  txnCount: number;
}

async function list(request: APIRequestContext, kind: 'bookmakers' | 'profiles'): Promise<Named[]> {
  const res = await request.get(`/api/${kind}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { items: Named[] }).items;
}

/** Apaga (em cascata) tudo o que este ficheiro criou. */
async function cleanup(request: APIRequestContext) {
  for (const kind of ['bookmakers', 'profiles'] as const) {
    for (const item of await list(request, kind)) {
      if (item.name.includes(tag)) await request.delete(`/api/${kind}/${item.id}`, { headers });
    }
  }
}

/** Cria casa, perfil e conta e importa o CSV pela API (sem passar pelo assistente). */
async function seed(request: APIRequestContext): Promise<string> {
  const create = async (kind: 'bookmakers' | 'profiles', base: string) => {
    const res = await request.post(`/api/${kind}`, { data: { name: name(base) }, headers });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()) as Named;
  };
  const house = await create('bookmakers', 'Casa A');
  const who = await create('profiles', 'Ana');
  const walletRes = await request.post('/api/wallets', {
    data: { profileId: who.id, bookmakerId: house.id },
    headers,
  });
  expect(walletRes.status()).toBe(201);
  const wallet = (await walletRes.json()) as { id: string };
  const importRes = await request.post('/api/imports', {
    data: { walletId: wallet.id, filename, csv },
    headers,
  });
  expect(importRes.status(), await importRes.text()).toBe(201);
  return wallet.id;
}

async function txnCount(request: APIRequestContext, walletId: string): Promise<number> {
  const res = await request.get('/api/wallets');
  expect(res.ok()).toBe(true);
  const wallet = ((await res.json()) as { items: (WalletItem & { id: string })[] }).items.find(
    (w) => w.id === walletId,
  );
  expect(wallet).toBeDefined();
  return wallet?.txnCount ?? -1;
}

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
}

const historyRegion = (page: Page) => page.getByRole('region', { name: 'Histórico de importações' });
const row = (page: Page) => historyRegion(page).getByRole('listitem').filter({ hasText: filename });

test.describe('Histórico de importações', () => {
  test.describe.configure({ mode: 'serial' });

  let walletId = '';
  test.beforeEach(async ({ request }) => {
    walletId = await seed(request);
  });
  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test('mostra o import, desfaz com confirmação e a conta fica sem transações', async ({ page, request }) => {
    expect(await txnCount(request, walletId)).toBe(3);
    await page.goto('/importar');

    await expect(row(page)).toBeVisible();
    await expect(row(page)).toContainText(account);
    await expect(row(page)).toContainText('Ativa');
    await expect(row(page).getByText('Adicionadas').locator('xpath=following-sibling::dd')).toHaveText('3');

    // cancelar não muda nada
    const undo = row(page).getByRole('button', { name: `Desfazer a importação de ${filename}` });
    await undo.click();
    const dialog = page.getByRole('dialog', { name: 'Desfazer esta importação?' });
    await expect(dialog).toContainText(
      `Remove as 3 transações que este import adicionou à conta ${account}. As outras transações não mudam.`,
    );
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(undo).toBeFocused();
    expect(await txnCount(request, walletId)).toBe(3);

    // confirmar desfaz
    await undo.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Desfazer importação' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row(page)).toContainText('Desfeito em');
    await expect(row(page).getByRole('button')).toHaveCount(0);
    await expect(historyRegion(page).getByRole('status')).toHaveText('Importação desfeita.');
    await expect(row(page)).toBeFocused();
    await expect.poll(() => txnCount(request, walletId)).toBe(0);

    // persiste depois de recarregar
    await page.reload();
    await expect(row(page)).toContainText('Desfeito em');
  });

  test('descarrega o CSV de exemplo com BOM, CRLF e o cabeçalho canónico', async ({ page }) => {
    await page.goto('/importar');
    await page.getByText('Como preparar o ficheiro CSV').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descarregar CSV de exemplo' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('exemplo-tento.csv');
    const path = await download.path();
    const text = readFileSync(path, 'utf8');
    expect(text.startsWith('﻿Date;Tipe;Vaule\r\n')).toBe(true);
    expect(text.split('\r\n').length).toBeGreaterThanOrEqual(7);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: sem violações em ${scheme}`, async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('tento:tema', value);
      }, scheme);
      await page.goto('/importar');
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(row(page)).toBeVisible();
      await expectNoViolations(page);

      await page.getByText('Como preparar o ficheiro CSV').click();
      await expect(page.getByRole('button', { name: 'Descarregar CSV de exemplo' })).toBeVisible();
      await expectNoViolations(page);

      await row(page)
        .getByRole('button', { name: `Desfazer a importação de ${filename}` })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('axe: sem violações a 390 px e sem scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/importar');
    await expect(row(page)).toBeVisible();
    await page.getByText('Como preparar o ficheiro CSV').click();
    await expect(page.getByRole('button', { name: 'Descarregar CSV de exemplo' })).toBeVisible();
    await expectNoViolations(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

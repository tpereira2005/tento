import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoAxeViolations } from './helpers';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const BOM = String.fromCharCode(0xfeff);

interface Named {
  id: string;
  name: string;
}

/** Apaga (em cascata) tudo o que este ficheiro criou, para não influenciar os outros testes. */
async function cleanup(request: APIRequestContext) {
  for (const kind of ['bookmakers', 'profiles'] as const) {
    const res = await request.get(`/api/${kind}`);
    for (const item of ((await res.json()) as { items: Named[] }).items) {
      if (item.name.includes(tag)) await request.delete(`/api/${kind}/${item.id}`, { headers });
    }
  }
}

/** Casa, perfil e conta, uma importação (2 linhas) e uma transação manual: 3 transações. */
async function seed(request: APIRequestContext) {
  const post = async (path: string, data: unknown, status = 201) => {
    const res = await request.post(path, { data, headers });
    expect(res.status(), await res.text()).toBe(status);
    return (await res.json()) as Named;
  };
  const house = await post('/api/bookmakers', { name: name('Casa Dados') });
  const who = await post('/api/profiles', { name: name('Perfil Dados') });
  const wallet = await post('/api/wallets', { profileId: who.id, bookmakerId: house.id });
  const csv = `${BOM}Date;Tipe;Vaule\r\n2026-01-05;Deposit;50,00\r\n2026-01-20;Withdrawal;80,00\r\n`;
  await post('/api/imports', { walletId: wallet.id, filename: `dados-${tag}.csv`, csv });
  await post('/api/transactions', {
    walletId: wallet.id,
    date: '2026-02-01',
    type: 'deposit',
    amountCents: 1234,
    note: `nota ${tag}`,
  });
}

interface Exported {
  format: string;
  version: number;
  exportedAt: string;
  user: { name: string; email: string };
  settings: { theme: string };
  profiles: { name: string }[];
  bookmakers: { name: string }[];
  wallets: unknown[];
  imports: { filename: string }[];
  transactions: { amountCents: number; type: string; note: string | null }[];
}

test.describe('Os teus dados', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ isMobile }) => isMobile, 'fluxo coberto no projeto desktop');
  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test('exporta todos os dados num ficheiro JSON completo e sem segredos', async ({ page, request }) => {
    await seed(request);
    await page.goto('/definicoes');
    const region = page.getByRole('region', { name: 'Os teus dados' });
    await expect(region).toBeVisible();

    const waiting = page.waitForEvent('download');
    await region.getByRole('button', { name: 'Exportar dados (JSON)' }).click();
    const file = await waiting;
    expect(file.suggestedFilename()).toMatch(/^tento-dados-\d{4}-\d{2}-\d{2}\.json$/);

    const text = await readFile(await file.path(), 'utf8');
    const data = JSON.parse(text) as Exported;
    expect(data).toMatchObject({ format: 'tento-export', version: 1 });
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.user.email).toMatch(/@tento\.test$/);
    expect(data.profiles.map((p) => p.name)).toContain(name('Perfil Dados'));
    expect(data.bookmakers.map((b) => b.name)).toContain(name('Casa Dados'));
    expect(data.imports.map((i) => i.filename)).toContain(`dados-${tag}.csv`);
    expect(data.transactions.filter((x) => x.note === `nota ${tag}`)).toHaveLength(1);
    expect(data.transactions.map((x) => x.amountCents)).toEqual(expect.arrayContaining([5000, 8000, 1234]));
    expect(text).not.toMatch(/"(password|token|accessToken|hash)"/i);
  });

  test('apagar todos os dados exige APAGAR, esvazia o painel e mantém a sessão', async ({
    page,
    request,
  }) => {
    await seed(request);
    await page.goto('/definicoes');
    const region = page.getByRole('region', { name: 'Os teus dados' });
    await region.getByRole('button', { name: 'Apagar todos os dados' }).click();

    const dialog = page.getByRole('dialog', { name: 'Apagar todos os dados?' });
    const confirm = dialog.getByRole('button', { name: 'Apagar tudo' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Escreve APAGAR para confirmar').fill('apagar');
    await expect(confirm).toBeDisabled();
    await expectNoAxeViolations(page);

    await dialog.getByLabel('Escreve APAGAR para confirmar').fill('APAGAR');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Avisos' })).toContainText('Todos os dados foram apagados');

    // listas das definições vazias, sem recarregar
    await expect(
      page.getByRole('region', { name: 'Casas' }).getByText('Ainda não tens casas.'),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Contas' }).getByText('Ainda não tens contas.'),
    ).toBeVisible();

    // a API confirma que não sobra nada e a sessão continua válida
    const txns = await request.get('/api/transactions');
    expect(txns.status()).toBe(200);
    expect(((await txns.json()) as { total: number }).total).toBe(0);
    const imports = await request.get('/api/imports');
    expect(((await imports.json()) as { items: unknown[] }).items).toEqual([]);

    // o painel volta ao estado de boas-vindas
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao Tento' })).toBeVisible();
  });
});

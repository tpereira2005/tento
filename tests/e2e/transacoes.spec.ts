import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectNoAxeViolations, setTheme } from './helpers';
import { shot } from './shots';
import { uniqueTag } from './tag';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = uniqueTag();
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const BOM = String.fromCharCode(0xfeff);

interface Named {
  id: string;
  name: string;
}

/** Formato canónico: BOM, CRLF, `Date;Tipe;Vaule`. Dados inventados. */
const csv = (lines: string[]) => `${BOM}${['Date;Tipe;Vaule', ...lines].join('\r\n')}\r\n`;

const BASE = [
  '2025-02-03;Deposit;50,00',
  '2025-02-10;Deposit;25,50',
  '2025-03-01;Withdrawal;120,00',
  '2025-03-15;Deposit;30,00',
  '2025-04-02;Withdrawal;75,25',
];
/** 60 depósitos de 1 a 60 euros, em dias diferentes. */
const MANY = Array.from({ length: 60 }, (_, i) => {
  const month = String(1 + Math.floor(i / 28)).padStart(2, '0');
  const day = String(1 + (i % 28)).padStart(2, '0');
  return `2024-${month}-${day};Deposit;${String(i + 1)},00`;
});

const ids = { profileAna: '', profileRui: '', bookmaker: '', wallet: '', walletMany: '' };

async function create(request: APIRequestContext, kind: 'bookmakers' | 'profiles', base: string) {
  const res = await request.post(`/api/${kind}`, { data: { name: name(base) }, headers });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Named;
}

async function addWallet(request: APIRequestContext, profileId: string, lines: string[], file: string) {
  const res = await request.post('/api/wallets', {
    data: { profileId, bookmakerId: ids.bookmaker },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
  const wallet = (await res.json()) as Named;
  const imp = await request.post('/api/imports', {
    data: { walletId: wallet.id, filename: file, csv: csv(lines) },
    headers,
  });
  expect(imp.status(), await imp.text()).toBe(201);
  return wallet.id;
}

async function seed(request: APIRequestContext) {
  ids.bookmaker = (await create(request, 'bookmakers', 'Casa A')).id;
  ids.profileAna = (await create(request, 'profiles', 'Ana')).id;
  ids.profileRui = (await create(request, 'profiles', 'Rui')).id;
  ids.wallet = await addWallet(request, ids.profileAna, BASE, 'base.csv');
  ids.walletMany = await addWallet(request, ids.profileRui, MANY, 'muitas.csv');
  // uma transação manual com nota, para a pesquisa
  const res = await request.post('/api/transactions', {
    data: {
      walletId: ids.wallet,
      date: '2025-04-10',
      type: 'deposit',
      amountCents: 1000,
      note: `nota ${tag}`,
    },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
}

async function cleanup(request: APIRequestContext) {
  for (const kind of ['bookmakers', 'profiles'] as const) {
    const res = await request.get(`/api/${kind}`);
    for (const item of ((await res.json()) as { items: Named[] }).items) {
      if (item.name.includes(tag)) await request.delete(`/api/${kind}/${item.id}`, { headers });
    }
  }
}

const listUrl = () => `/transacoes?conta=${ids.wallet}`;
const bodyRows = (page: Page) => page.getByRole('table').getByRole('row');

/** A lista carregou: a tabela (ou a lista empilhada) e a contagem estão desenhadas. */
async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible();
  await expect(page.getByText(/^\d+ transaç(ão|ões)$/)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Resultado líquido do Painel para a conta de teste (perfil + casa, todo o período). */
async function panelNet(page: Page): Promise<string | undefined> {
  await page.goto(`/?perfil=${ids.profileAna}&casa=${ids.bookmaker}&periodo=tudo`);
  const hero = page.getByRole('region', { name: /Resultado líquido/ });
  await expect(hero).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultado acumulado' })).toBeVisible();
  const text = (await hero.innerText()).replace(/\s+/g, ' ');
  // o número grande a seguir ao rótulo "levantado − depositado"
  return /DEPOSITADO ([\d., ]+) €/.exec(text)?.[1]?.trim();
}

test.describe('Transações', () => {
  test.skip(({ isMobile }) => isMobile, 'o ecrã de 390 px é testado com viewport próprio no projeto desktop');

  test.beforeAll(async ({ request }) => {
    await seed(request);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test('a lista mostra as linhas, o total e as somas do filtro', async ({ page }) => {
    await page.goto(listUrl());
    await ready(page);
    await expect(page.getByText('6 transações', { exact: true })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(7);

    const sums = page.getByRole('region', { name: 'Somas das transações filtradas' });
    await expect(sums).toContainText('115,50');
    await expect(sums).toContainText('195,25');
    await expect(sums).toContainText('+79,75');

    const newest = bodyRows(page).nth(1);
    await expect(newest).toContainText('10/04/2025');
    await expect(newest).toContainText(`${name('Ana')} · ${name('Casa A')}`);
    await expect(newest).toContainText('Manual');
    await expect(newest).toContainText(`nota ${tag}`);
    await expect(bodyRows(page).nth(2)).toContainText('CSV');
    await expect(page.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute('href', '/importar');
  });

  test('filtrar por tipo e pesquisar nas notas atualiza o URL e a lista', async ({ page }) => {
    await page.goto(listUrl());
    await ready(page);

    await page.getByRole('combobox', { name: 'Tipo' }).click();
    await page.getByRole('option', { name: 'Depósitos' }).click();
    await expect(page).toHaveURL(/tipo=deposit/);
    await expect(page.getByText('4 transações', { exact: true })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(5);
    await expect(page.getByRole('region', { name: 'Somas das transações filtradas' })).toContainText(
      'não as alteram',
    );

    await page.getByRole('searchbox').fill(`nota ${tag}`);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByText('1 transação', { exact: true })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(2);

    // o URL guarda os filtros
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Tipo' })).toContainText('Depósitos');
    await expect(page.getByRole('searchbox')).toHaveValue(`nota ${tag}`);
    await expect(page.getByText('1 transação', { exact: true })).toBeVisible();

    await page.getByRole('searchbox').fill(`nada ${tag}`);
    await expect(page.getByText('Nenhuma transação com estes filtros.')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page).not.toHaveURL(/q=|tipo=/);
    await expect(page.getByText('Nenhuma transação com estes filtros.')).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });

  test('adicionar, editar e apagar refletem-se no Painel', async ({ page }) => {
    const before = await panelNet(page);
    expect(before).toBe('79,75');

    // adicionar
    await page.goto(listUrl());
    await ready(page);
    await page.getByRole('button', { name: 'Adicionar transação' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Adicionar transação' });
    await expect(dialog.getByRole('combobox', { name: 'Conta' })).toContainText(name('Ana'));
    await dialog.getByLabel('Data').fill('2026-01-15');
    await dialog.getByLabel('Valor').fill('40,5');
    await expect(dialog.getByText('= 40,50 €')).toBeVisible();
    await dialog.getByLabel('Nota (opcional)').fill(`manual ${tag}`);
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status', { name: 'Avisos' })).toHaveText('Transação adicionada.');
    await expect(page.getByText('7 transações', { exact: true })).toBeVisible();
    const added = bodyRows(page).nth(1);
    await expect(added).toContainText('15/01/2026');
    await expect(added).toContainText('Manual');
    await expect(added).toContainText(`manual ${tag}`);

    let net = await panelNet(page);
    expect(net).toBe('39,25');

    // editar o montante
    await page.goto(listUrl());
    await ready(page);
    await page.getByRole('button', { name: /^Editar transação de 15\/01\/2026/ }).click();
    const edit = page.getByRole('dialog', { name: 'Editar transação' });
    await expect(edit.getByText(/veio de um CSV/)).toHaveCount(0);
    await edit.getByLabel('Valor').fill('50');
    await edit.getByRole('button', { name: 'Guardar' }).click();
    await expect(edit).toBeHidden();
    await expect(bodyRows(page).nth(1)).toContainText('50,00');
    net = await panelNet(page);
    expect(net).toBe('29,75');

    // apagar, com confirmação
    await page.goto(listUrl());
    await ready(page);
    await page.getByRole('button', { name: /^Apagar transação de 15\/01\/2026/ }).click();
    const confirm = page.getByRole('dialog', { name: 'Apagar esta transação?' });
    await expect(confirm).toContainText('Depósito de 50,00 € em 15/01/2026');
    await expect(confirm).toContainText(name('Ana'));
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('7 transações', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Apagar transação de 15\/01\/2026/ }).click();
    await confirm.getByRole('button', { name: 'Apagar transação' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText('6 transações', { exact: true })).toBeVisible();
    net = await panelNet(page);
    expect(net).toBe('79,75');
  });

  test('editar uma linha de CSV avisa do conflito na reimportação', async ({ page }) => {
    await page.goto(`${listUrl()}&periodo=tudo`);
    await ready(page);
    await page.getByRole('button', { name: /^Editar transação de 03\/02\/2025/ }).click();
    const edit = page.getByRole('dialog', { name: 'Editar transação' });
    await expect(
      edit.getByText(
        'Esta transação veio de um CSV. Se a reimportares com outro valor vai aparecer como conflito.',
      ),
    ).toBeVisible();
    await edit.getByRole('button', { name: 'Cancelar' }).click();
    await expect(edit).toBeHidden();
  });

  test('Carregar mais junta mais 50 linhas e desaparece no fim', async ({ page }) => {
    await page.goto(`/transacoes?conta=${ids.walletMany}`);
    await ready(page);
    await expect(page.getByText('60 transações', { exact: true })).toBeVisible();
    await expect(bodyRows(page)).toHaveCount(51);
    await expect(page.getByText('A mostrar 50 de 60')).toBeVisible();
    await page.getByRole('button', { name: 'Carregar mais' }).click();
    await expect(bodyRows(page)).toHaveCount(61);
    await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0);
    await expect(page.getByText('A mostrar 60 de 60')).toBeVisible();
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`1440 px, tema ${tema}: sem violações, também com o diálogo aberto`, async ({ page }) => {
      await setTheme(page, tema);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(listUrl());
      await ready(page);
      await expectNoAxeViolations(page);
      if (tema === 'light') await shot(page, 'etapa6-transacoes-1440-claro');

      await page.getByRole('button', { name: /^Editar transação de 03\/02\/2025/ }).click();
      await expect(page.getByRole('dialog', { name: 'Editar transação' })).toBeVisible();
      await expectNoAxeViolations(page);
      if (tema === 'dark') await shot(page, 'etapa6-transacoes-1440-escuro-dialogo');
    });
  }

  test('390 px: lista empilhada, sem violações e sem scroll horizontal', async ({ page }) => {
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(listUrl());
    await ready(page);
    await expect(page.getByRole('list', { name: 'Transações' }).getByRole('listitem')).toHaveCount(6);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expectNoAxeViolations(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'etapa6-transacoes-390-claro');

    await page
      .getByRole('button', { name: /^Adicionar transação/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Adicionar transação' });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);
    const overflowOpen = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowOpen).toBeLessThanOrEqual(0);
    await shot(page, 'etapa6-transacoes-390-claro-dialogo');
  });
});

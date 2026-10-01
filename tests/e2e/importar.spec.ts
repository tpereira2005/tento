import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectNoAxeViolations, setTheme } from './helpers';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;

interface Named {
  id: string;
  name: string;
}

const BOM = String.fromCharCode(0xfeff);
/** Formato canónico: BOM, CRLF, `Date;Tipe;Vaule`. Dados inventados. */
const csv = (...lines: string[]) => `${BOM}${['Date;Tipe;Vaule', ...lines].join('\r\n')}\r\n`;
const file = (name: string, text: string) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(text, 'utf8'),
});

const BASE = [
  '2025-02-03;Deposit;50,00',
  '2025-02-10;Deposit;25,50',
  '2025-03-01;Withdrawal;120,00',
  '2025-03-15;Deposit;30,00',
  '2025-04-02;Withdrawal;75,25',
];

let walletId = '';
let accountLabel = '';

async function list(request: APIRequestContext, kind: 'bookmakers' | 'profiles'): Promise<Named[]> {
  const res = await request.get(`/api/${kind}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { items: Named[] }).items;
}

async function cleanup(request: APIRequestContext) {
  for (const kind of ['bookmakers', 'profiles'] as const) {
    for (const item of await list(request, kind)) {
      if (item.name.includes(tag)) await request.delete(`/api/${kind}/${item.id}`, { headers });
    }
  }
}

async function seed(request: APIRequestContext) {
  const create = async (kind: 'bookmakers' | 'profiles', base: string) => {
    const res = await request.post(`/api/${kind}`, { data: { name: name(base) }, headers });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()) as Named;
  };
  const house = await create('bookmakers', 'Casa A');
  const who = await create('profiles', 'Ana');
  const res = await request.post('/api/wallets', {
    data: { profileId: who.id, bookmakerId: house.id },
    headers,
  });
  expect(res.status()).toBe(201);
  walletId = ((await res.json()) as Named).id;
  accountLabel = `${name('Ana')} · ${name('Casa A')}`;
}

async function importViaApi(request: APIRequestContext, text: string) {
  const res = await request.post('/api/imports', {
    data: { walletId, filename: 'base.csv', csv: text },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** Passo 1 → 2 e escolhe o ficheiro; a pré-visualização abre sozinha. */
async function pick(page: Page, f: ReturnType<typeof file>) {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Ficheiro' })).toBeFocused();
  await page.getByLabel('Ficheiro CSV', { exact: true }).setInputFiles(f);
  await expect(page.getByRole('heading', { level: 2, name: 'Pré-visualização' })).toBeFocused();
}

function tile(page: Page, label: string) {
  return page
    .getByRole('group', { name: 'Resumo da análise' })
    .getByText(label, { exact: true })
    .locator('xpath=..');
}

async function expectCounts(page: Page, counts: Record<string, number>) {
  await expect(page.getByRole('group', { name: 'Resumo da análise' })).toBeVisible();
  for (const [label, n] of Object.entries(counts)) {
    await expect(tile(page, label)).toContainText(String(n));
  }
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Importar', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ request }) => {
    await seed(request);
  });
  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test('importa, repete, deteta conflito, mostra erros e recusa ficheiro sem cabeçalho', async ({ page }) => {
    await page.goto(`/importar?conta=${walletId}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Importar' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Conta' })).toContainText(accountLabel);

    // 1. cinco linhas novas
    await pick(page, file('ana-casa-a.csv', csv(...BASE)));
    await expectCounts(page, {
      'Linhas no ficheiro': 5,
      Válidas: 5,
      Novas: 5,
      'Já importadas': 0,
      Conflitos: 0,
      'Com erros': 0,
    });
    await expect(page.getByRole('table', { name: 'Novas transações' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Confirmar' })).toBeFocused();
    await page.getByRole('button', { name: 'Importar 5 transações' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Importação concluída' })).toBeFocused();
    await expect(page.getByText(`5 transações adicionadas à conta ${accountLabel}.`).first()).toBeVisible();
    await expect(page.getByText(/chega na etapa 5/)).toBeVisible();

    // 2. o mesmo ficheiro outra vez: nada de novo
    await page.getByRole('button', { name: 'Importar outro ficheiro' }).click();
    await page
      .getByLabel('Ficheiro CSV', { exact: true })
      .setInputFiles(file('ana-casa-a.csv', csv(...BASE)));
    await expectCounts(page, { Novas: 0, 'Já importadas': 5, Conflitos: 0 });
    await expect(page.getByText('Nada de novo para importar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    // 3. um valor editado: conflito, e nada é importado por causa dele
    await page.getByRole('button', { name: 'Voltar' }).click();
    const edited = [...BASE];
    edited[1] = '2025-02-10;Deposit;26,00';
    await page.getByLabel('Ficheiro CSV', { exact: true }).setInputFiles(file('editado.csv', csv(...edited)));
    await expectCounts(page, { Novas: 0, 'Já importadas': 4, Conflitos: 1 });
    const conflicts = page.getByRole('table', { name: 'Conflitos' });
    await expect(conflicts).toContainText('10/02/2025');
    await expect(conflicts).toContainText('26,00');
    await expect(conflicts).toContainText('25,50');
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    // 4. duas linhas inválidas e uma nova: o resto importa-se
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page
      .getByLabel('Ficheiro CSV', { exact: true })
      .setInputFiles(
        file(
          'com-erros.csv',
          csv(...BASE, '2025-02-30;Deposit;10,00', '2025-05-01;Deposit;abc', '2025-05-10;Deposit;40,00'),
        ),
      );
    await expectCounts(page, { 'Linhas no ficheiro': 8, Novas: 1, 'Já importadas': 5, 'Com erros': 2 });
    const errors = page.getByRole('table', { name: 'Erros por linha' });
    await expect(errors).toContainText('Data inválida');
    await expect(errors).toContainText('2025-02-30');
    await expect(errors).toContainText('Valor inválido');
    await expect(errors).toContainText('abc');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Importar 1 transação' }).click();
    await expect(page.getByText(`1 transação adicionada à conta ${accountLabel}.`).first()).toBeVisible();
    await expect(page.getByText(/2 linhas com erros/)).toBeVisible();

    // 5. sem cabeçalho: erro fatal com ligação ao formato
    await page.getByRole('button', { name: 'Importar outro ficheiro' }).click();
    await page
      .getByLabel('Ficheiro CSV', { exact: true })
      .setInputFiles(file('sem-cabecalho.csv', `${BASE.join('\r\n')}\r\n`));
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível ler este ficheiro' });
    await expect(alert).toContainText('Não encontrámos o cabeçalho');
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await alert.getByRole('button', { name: 'Ver o formato aceite' }).click();
    await expect(page.locator('details#formato')).toHaveAttribute('open', '');
    await expect(page.locator('details#formato > summary')).toBeFocused();
  });

  const variants = [
    { label: 'claro', scheme: 'light', width: 0 },
    { label: 'escuro', scheme: 'dark', width: 0 },
    { label: 'a 390 px', scheme: 'light', width: 390 },
  ] as const;

  for (const v of variants) {
    test(`axe: sem violações em todos os passos (${v.label})`, async ({ page, request }) => {
      await importViaApi(request, csv(...BASE));
      await setTheme(page, v.scheme);
      if (v.width) await page.setViewportSize({ width: v.width, height: 844 });
      await page.goto(`/importar?conta=${walletId}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', v.scheme);
      const check = async () => {
        await expectNoAxeViolations(page);
        if (v.width) await noOverflow(page);
      };

      await expect(page.getByRole('combobox', { name: 'Conta' })).toContainText(accountLabel);
      await check(); // passo 1

      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByLabel('Ficheiro CSV', { exact: true })).toBeAttached();
      await check(); // passo 2

      const edited = [...BASE];
      edited[1] = '2025-02-10;Deposit;26,00';
      await page
        .getByLabel('Ficheiro CSV', { exact: true })
        .setInputFiles(
          file('misto.csv', csv(...edited, '2025-02-30;Deposit;10,00', '2025-05-10;Withdrawal;40,00')),
        );
      await expectCounts(page, { Novas: 1, Conflitos: 1, 'Com erros': 1 });
      await expect(page.getByRole('table', { name: 'Conflitos' })).toBeVisible();
      await expect(page.getByRole('table', { name: 'Erros por linha' })).toBeVisible();
      await check(); // passo 3

      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('button', { name: 'Importar 1 transação' })).toBeVisible();
      await check(); // passo 4

      await page.getByRole('button', { name: 'Importar 1 transação' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Importação concluída' })).toBeVisible();
      await check(); // resumo
    });
  }
});

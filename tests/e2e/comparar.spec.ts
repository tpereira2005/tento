import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { demoRows, DEMO_WALLETS, type DemoWalletKey } from '../../src/server/db/demo-dataset';
import { expectNoAxeViolations, setTheme } from './helpers';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const MINUS = String.fromCharCode(0x2212);
const EN_DASH = String.fromCharCode(0x2013);
const SHOTS = 'C:\\Users\\tomas\\bt-analise\\shots';
/** O relógio do navegador fixa-se aqui: os períodos "últimos 12 meses" dão sempre out 2025 – set 2026. */
const FIXED_NOW = new Date('2026-09-30T12:00:00Z');

interface Named {
  id: string;
  name: string;
}

const BOM = String.fromCharCode(0xfeff);
const eur = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;

/** Formato canónico (`Date;Tipe;Vaule`) a partir das linhas do conjunto de demonstração. */
function demoCsv(key: DemoWalletKey): string {
  const lines = demoRows()[key].map(
    (r) => `${r.date};${r.type === 'deposit' ? 'Deposit' : 'Withdrawal'};${eur(r.amountCents)}`,
  );
  return `${BOM}${['Date;Tipe;Vaule', ...lines].join('\r\n')}\r\n`;
}

const ids = { profiles: {} as Record<string, string>, bookmakers: {} as Record<string, string> };

async function create(request: APIRequestContext, kind: 'bookmakers' | 'profiles', base: string) {
  const res = await request.post(`/api/${kind}`, { data: { name: name(base) }, headers });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Named;
}

async function cleanup(request: APIRequestContext) {
  for (const kind of ['bookmakers', 'profiles'] as const) {
    const res = await request.get(`/api/${kind}`);
    for (const item of ((await res.json()) as { items: Named[] }).items) {
      if (item.name.includes(tag)) await request.delete(`/api/${kind}/${item.id}`, { headers });
    }
  }
}

async function seed(request: APIRequestContext) {
  for (const base of ['Casa A', 'Casa B'])
    ids.bookmakers[base] = (await create(request, 'bookmakers', base)).id;
  for (const base of ['Ana', 'Rui']) ids.profiles[base] = (await create(request, 'profiles', base)).id;
  for (const w of DEMO_WALLETS) {
    const res = await request.post('/api/wallets', {
      data: { profileId: ids.profiles[w.profile], bookmakerId: ids.bookmakers[w.bookmaker] },
      headers,
    });
    expect(res.status(), await res.text()).toBe(201);
    const wallet = (await res.json()) as Named;
    const imp = await request.post('/api/imports', {
      data: { walletId: wallet.id, filename: `${w.key}.csv`, csv: demoCsv(w.key) },
      headers,
    });
    expect(imp.status(), await imp.text()).toBe(201);
  }
}

const perfisUrl = () =>
  `/comparar?modo=perfis&a=${ids.profiles.Ana ?? ''}&b=${ids.profiles.Rui ?? ''}&periodo=tudo`;
const casasUrl = () =>
  `/comparar?modo=casas&a=${ids.bookmakers['Casa A'] ?? ''}&b=${ids.bookmakers['Casa B'] ?? ''}&periodo=tudo`;
const periodosUrl = '/comparar?modo=periodos&a=12m&b=anterior';

/** A página carregou: os dois lados e os gráficos estão desenhados. */
async function ready(page: Page) {
  await expect(page.getByRole('region', { name: 'Resultado acumulado' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Diferença' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, file: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}\\etapa6-comparar-${file}.png`, fullPage: true });
}

test.describe('Comparar', () => {
  test.skip(({ isMobile }) => isMobile, 'o ecrã de 390 px é testado com viewport próprio no projeto desktop');

  test.beforeAll(async ({ request }) => {
    await seed(request);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
  });

  test('perfis: Ana vs Rui com os números do conjunto de demonstração', async ({ page }) => {
    await page.goto(perfisUrl());
    await ready(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Comparar' })).toBeVisible();
    await expect(page).toHaveTitle(/Comparar/);

    const ana = page.getByRole('region', { name: name('Ana'), exact: true });
    const rui = page.getByRole('region', { name: name('Rui'), exact: true });
    await expect(ana).toContainText(`${MINUS}607,50 €`);
    await expect(rui).toContainText(`${MINUS}57,00 €`);
    for (const side of [ana, rui]) {
      await expect(side).toContainText('Resultado líquido');
      await expect(side).toContainText('Depositado');
      await expect(side).toContainText('Levantado');
      await expect(side).toContainText('Meses positivos');
      await expect(side).toContainText('Média mensal');
      await expect(side).toContainText('Melhor mês');
      await expect(side).toContainText('Pior mês');
    }

    const diff = page.getByRole('region', { name: 'Diferença' });
    await expect(diff).toContainText(
      `Resultado líquido: ${name('Ana')} ${MINUS}607,50 € · ${name('Rui')} ${MINUS}57,00 € · diferença ${MINUS}550,50 €`,
    );
    await expect(diff.getByRole('table')).toBeVisible();

    // os dois lados são distintos e a opção do outro lado está desativada
    await expect(page.getByRole('combobox', { name: 'Lado A' })).toContainText(name('Ana'));
    await expect(page.getByRole('combobox', { name: 'Lado B' })).toContainText(name('Rui'));
    await page.getByRole('combobox', { name: 'Lado A' }).click();
    await expect(page.getByRole('option', { name: name('Rui') })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');

    // gráficos com descrição e tabela alternativa
    const cumulative = page.getByRole('region', { name: 'Resultado acumulado' });
    await expect(cumulative.getByRole('img')).toHaveAccessibleName(
      new RegExp(`Resultado acumulado de ${name('Ana')} e de ${name('Rui')} em 12 meses`),
    );
    await cumulative.getByRole('button', { name: 'Ver como tabela' }).click();
    await expect(cumulative.getByRole('row')).toHaveCount(13);
    await cumulative.getByRole('button', { name: 'Ver gráfico' }).click();
    const monthly = page.getByRole('region', { name: 'Resultado mensal' });
    await expect(monthly.getByRole('img')).toHaveCount(2);
  });

  test('casas: Casa A vs Casa B ao mudar de modo', async ({ page }) => {
    await page.goto(perfisUrl());
    await ready(page);
    await page.getByRole('radio', { name: 'Casas' }).click();
    await expect(page).toHaveURL(/modo=casas/);
    // mudar de modo limpa os lados do modo anterior
    await expect(page).not.toHaveURL(new RegExp(ids.profiles.Ana ?? 'x'));

    // com dados de outras execuções a escolha por omissão pode variar: fixa-se por URL
    await page.goto(casasUrl());
    await ready(page);
    const a = page.getByRole('region', { name: name('Casa A'), exact: true });
    const b = page.getByRole('region', { name: name('Casa B'), exact: true });
    await expect(a).toContainText(`${MINUS}569,30 €`);
    await expect(b).toContainText(`${MINUS}95,20 €`);
    await expect(page.getByRole('region', { name: 'Diferença' })).toContainText(`diferença ${MINUS}474,10 €`);
  });

  test('períodos: 12 meses vs os 12 anteriores, com meses a zeros na tabela', async ({ page }) => {
    await page.goto(periodosUrl);
    await ready(page);
    const a = page.getByRole('region', { name: `out 2025 ${EN_DASH} set 2026`, exact: true });
    const b = page.getByRole('region', { name: `out 2024 ${EN_DASH} set 2025`, exact: true });
    await expect(a).toContainText(`${MINUS}664,50 €`);
    await expect(a).toContainText('Resultado líquido');
    await expect(b).toContainText('Sem movimentos');
    await expect(page.getByRole('combobox', { name: 'Comparar com' })).toContainText('vs período anterior');
    await expect(page.getByRole('radio', { name: '12M' })).toBeChecked();

    const cumulative = page.getByRole('region', { name: 'Resultado acumulado' });
    await expect(cumulative).toContainText('alinhados por posição');
    await cumulative.getByRole('button', { name: 'Ver como tabela' }).click();
    const rows = cumulative.getByRole('row');
    await expect(rows).toHaveCount(13);
    // o lado sem movimentos fica a zeros em todos os meses
    await expect(rows.nth(1)).toContainText('out 2025 / out 2024');
    await expect(rows.nth(1)).toContainText('0,00 €');
    await expect(rows.nth(12)).toContainText('set 2026 / set 2025');
    await expect(rows.nth(12)).toContainText(`${MINUS}664,50 €`);

    // mesmo período do ano anterior
    await page.getByRole('combobox', { name: 'Comparar com' }).click();
    await page.getByRole('option', { name: 'vs mesmo período do ano anterior' }).click();
    await expect(page).toHaveURL(/b=ano/);
    await expect(
      page.getByRole('region', { name: `out 2024 ${EN_DASH} set 2025`, exact: true }),
    ).toBeVisible();
  });

  test('os filtros ficam no URL e sobrevivem ao recarregar', async ({ page }) => {
    // lados trocados (Rui no A, Ana no B) para provar que o URL manda
    await page.goto(
      `/comparar?modo=perfis&a=${ids.profiles.Rui ?? ''}&b=${ids.profiles.Ana ?? ''}&periodo=tudo`,
    );
    await ready(page);
    await expect(page.getByRole('combobox', { name: 'Lado A' })).toContainText(name('Rui'));
    await expect(page.getByRole('radio', { name: 'Tudo' })).toBeChecked();

    await page.getByRole('radio', { name: '6M' }).click();
    await expect(page).toHaveURL(/periodo=6m/);
    await expect(page).toHaveURL(new RegExp(`a=${ids.profiles.Rui ?? ''}`));
    await expect(page).toHaveURL(new RegExp(`b=${ids.profiles.Ana ?? ''}`));

    await page.reload();
    await expect(page).toHaveURL(/periodo=6m/);
    await expect(page.getByRole('radio', { name: 'Perfis' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '6M' })).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Lado A' })).toContainText(name('Rui'));
    await expect(page.getByRole('combobox', { name: 'Lado B' })).toContainText(name('Ana'));
    await expect(page.getByRole('region', { name: 'Resultado mensal' })).toBeVisible();
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`1440 px, tema ${tema}: sem violações de acessibilidade`, async ({ page }) => {
      await setTheme(page, tema);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(perfisUrl());
      await ready(page);
      await expectNoAxeViolations(page);
      // também com as tabelas alternativas abertas
      for (const title of ['Resultado acumulado', 'Resultado mensal']) {
        await page
          .getByRole('region', { name: title })
          .getByRole('button', { name: 'Ver como tabela' })
          .click();
      }
      await expectNoAxeViolations(page);
      for (const title of ['Resultado acumulado', 'Resultado mensal']) {
        await page.getByRole('region', { name: title }).getByRole('button', { name: 'Ver gráfico' }).click();
      }
      await shot(page, `perfis-1440-${tema === 'light' ? 'claro' : 'escuro'}`);
    });
  }

  test('1440 px, modo períodos: sem violações de acessibilidade', async ({ page }) => {
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(periodosUrl);
    await ready(page);
    await expectNoAxeViolations(page);
    await shot(page, 'periodos-1440-claro');
  });

  test('390 px: sem violações, sem scroll horizontal', async ({ page }) => {
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of [perfisUrl(), periodosUrl]) {
      await page.goto(url);
      await ready(page);
      await expectNoAxeViolations(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
    await page.goto(perfisUrl());
    await ready(page);
    await shot(page, 'perfis-390-claro');
  });
});

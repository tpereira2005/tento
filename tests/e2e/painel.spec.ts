import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { demoRows, DEMO_WALLETS, type DemoWalletKey } from '../../src/server/db/demo-dataset';
import { expectNoAxeViolations, setTheme, watchCsp } from './helpers';
import { shot } from './shots';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const MINUS = String.fromCharCode(0x2212);

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

const heroOf = (page: Page) => page.getByRole('region', { name: /Resultado líquido/ });

/** O painel carregou: o resultado líquido e os gráficos estão desenhados. */
async function ready(page: Page) {
  await expect(heroOf(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultado acumulado' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Painel', () => {
  test.skip(({ isMobile }) => isMobile, 'o ecrã de 390 px é testado com viewport próprio no projeto desktop');

  test.beforeAll(async ({ request }) => {
    await seed(request);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test('mostra os números do conjunto de demonstração', async ({ page }) => {
    const cspViolations = watchCsp(page);
    await page.goto('/?periodo=tudo');
    await ready(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
    await expect(page.getByText(/Fluxo de caixa de 3 contas em 2 casas · out 2025 . set 2026/)).toBeVisible();

    const hero = heroOf(page);
    await expect(hero).toContainText(`${MINUS}664,50`);
    await expect(hero).toContainText('Levantaste 84,5 % do que depositaste em todo o período.');
    await expect(hero).toContainText('Meses positivos');
    await expect(hero.getByText('de 12', { exact: true })).toBeVisible();
    await expect(hero.getByText('5', { exact: true })).toBeVisible();
    await expect(hero.getByRole('list', { name: 'Resultado de cada mês' }).getByRole('listitem')).toHaveCount(
      12,
    );
    await expect(hero).toContainText(`${MINUS}55,38`);
    await expect(hero).toContainText('+310,00');
    await expect(hero).toContainText(`${MINUS}284,50`);

    // contas: Ana·Casa A, Ana·Casa B, Rui·Casa A
    const accounts = page.getByRole('region', { name: 'Contas' });
    await expect(
      accounts.getByRole('listitem').filter({ hasText: name('Ana') + ' · ' + name('Casa A') }),
    ).toContainText(`${MINUS}512,30`);
    await expect(
      accounts.getByRole('listitem').filter({ hasText: name('Ana') + ' · ' + name('Casa B') }),
    ).toContainText(`${MINUS}95,20`);
    await expect(
      accounts.getByRole('listitem').filter({ hasText: name('Rui') + ' · ' + name('Casa A') }),
    ).toContainText(`${MINUS}57,00`);
    await expect(accounts.getByText(/importado a \d{2}\/\d{2}\/\d{4}/)).toHaveCount(3);

    // destaques e placar
    const insights = page.getByRole('region', { name: 'Destaques' });
    await expect(insights.getByRole('listitem')).toHaveCount(3);
    await expect(insights).toContainText('foi o pior mês do período');
    await expect(page.getByRole('region', { name: `${name('Ana')} vs ${name('Rui')}` })).toContainText(
      '91 %',
    );

    // transações recentes
    const recent = page.getByRole('region', { name: 'Transações recentes' });
    await expect(recent.getByRole('row')).toHaveCount(6);
    await expect(recent.getByRole('link', { name: /Ver todas/ })).toHaveAttribute('href', '/transacoes');

    // exportar PDF está disponível (a geração é testada em relatorios.spec.ts)
    await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Importar CSV' })).toHaveAttribute('href', '/importar');
    // a política de segurança (CSP) não bloqueou nada (gráficos, fontes, tema inicial)
    expect(cspViolations).toEqual([]);
  });

  test('o gráfico acumulado alterna para a tabela', async ({ page }) => {
    await page.goto('/?periodo=tudo');
    await ready(page);
    const card = page.getByRole('region', { name: 'Resultado acumulado' });
    await expect(card).toContainText('abaixo de zero desde abril');
    await card.getByRole('button', { name: 'Ver como tabela' }).click();
    await expect(card.getByRole('table')).toBeVisible();
    await expect(card.getByRole('row')).toHaveCount(13);
    await card.getByRole('button', { name: 'Ver gráfico' }).click();
    await expect(card.getByRole('table')).toHaveCount(0);
  });

  test('os filtros atualizam o URL e sobrevivem ao recarregar', async ({ page }) => {
    await page.goto('/?periodo=tudo');
    await ready(page);

    await page.getByRole('combobox', { name: 'Perfil' }).click();
    await page.getByRole('option', { name: name('Ana') }).click();
    await expect(page).toHaveURL(new RegExp(`perfil=${ids.profiles.Ana ?? ''}`));
    await expect(heroOf(page)).toContainText(`${MINUS}607,50`);

    await page.getByRole('combobox', { name: 'Casa' }).click();
    await page.getByRole('option', { name: name('Casa B') }).click();
    await expect(page).toHaveURL(new RegExp(`casa=${ids.bookmakers['Casa B'] ?? ''}`));
    await expect(heroOf(page)).toContainText(`${MINUS}95,20`);

    await page.getByRole('radio', { name: '6M' }).click();
    await expect(page).toHaveURL(/periodo=6m/);

    await page.reload();
    await expect(page).toHaveURL(/perfil=.*casa=|casa=.*perfil=/);
    await expect(page.getByRole('radio', { name: '6M' })).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Perfil' })).toContainText(name('Ana'));
    await expect(page.getByRole('combobox', { name: 'Casa' })).toContainText(name('Casa B'));
    await expect(page.getByRole('region', { name: 'Resultado mensal' })).toBeVisible();
  });

  test('uma combinação sem movimentos mostra uma mensagem calma', async ({ page }) => {
    // a Rui não tem conta na Casa B
    await page.goto(`/?periodo=tudo&perfil=${ids.profiles.Rui ?? ''}&casa=${ids.bookmakers['Casa B'] ?? ''}`);
    await expect(page.getByText('Sem movimentos neste período.')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`1440 px, tema ${tema}: sem violações de acessibilidade`, async ({ page }) => {
      await setTheme(page, tema);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/?periodo=tudo');
      await ready(page);
      await expectNoAxeViolations(page);
      await shot(page, `etapa5-painel-1440-${tema === 'light' ? 'claro' : 'escuro'}`);
    });
  }

  test('390 px: sem violações, sem scroll horizontal', async ({ page }) => {
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?periodo=tudo');
    await ready(page);
    await expectNoAxeViolations(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'etapa5-painel-390-claro');
  });
});

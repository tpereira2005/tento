import { expect, test, type APIRequestContext, type Download, type Page } from '@playwright/test';
import { formatCents } from '../../src/core/format';
import { demoRows, DEMO_WALLETS, type DemoWalletKey } from '../../src/server/db/demo-dataset';
import { expectNoAxeViolations, setTheme, watchCsp } from './helpers';
import { norm, readPdfText } from './pdf-text';
import { shot } from './shots';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;
const MINUS = String.fromCharCode(0x2212);
const TODAY_FILE = /^tento-relatorio-\d{4}-\d{2}-\d{2}\.pdf$/;
/** Meta de tempo do clique até ao descarregamento, com estes dados (ms). */
const TARGET_MS = 3000;

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

/** A página carregou: o âmbito e a pré-visualização estão visíveis. */
async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeVisible();
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview).toContainText('resultado líquido');
  await page.evaluate(() => document.fonts.ready);
}

/** Clica e espera pelo descarregamento; devolve o ficheiro e o tempo (ms) desde o clique. */
async function download(page: Page, click: () => Promise<void>): Promise<{ file: Download; ms: number }> {
  const waiting = page.waitForEvent('download', { timeout: 30_000 });
  const start = Date.now();
  await click();
  const file = await waiting;
  return { file, ms: Date.now() - start };
}

const known = (() => {
  const row = demoRows()['rui-a'][0];
  if (!row) throw new Error('sem linhas de demonstração');
  const [y, m, d] = row.date.split('-');
  return { date: `${d ?? ''}/${m ?? ''}/${y ?? ''}`, amount: norm(formatCents(row.amountCents)) };
})();

test.describe('Relatórios', () => {
  test.skip(({ isMobile }) => isMobile, 'o ecrã de 390 px é testado com viewport próprio no projeto desktop');

  test.beforeAll(async ({ request }) => {
    await seed(request);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test('gera o PDF do âmbito completo e o ficheiro tem o conteúdo certo', async ({ page }) => {
    const cspViolations = watchCsp(page);
    await page.goto('/relatorios');
    await ready(page);
    await page.getByRole('radio', { name: 'Tudo' }).click();
    await expect(page.getByRole('region', { name: 'Pré-visualização' })).toContainText(`${MINUS}664,50`);

    const { file, ms } = await download(page, () => page.getByRole('button', { name: 'Gerar PDF' }).click());
    console.log(
      `[tempo] Relatórios: clique até descarregamento = ${String(ms)} ms (meta ${String(TARGET_MS)} ms)`,
    );
    expect(file.suggestedFilename()).toMatch(TODAY_FILE);
    expect(ms).toBeLessThan(TARGET_MS);

    const path = await file.path();
    const pdf = await readPdfText(path);
    expect(pdf.pages).toBeGreaterThanOrEqual(4);
    expect(pdf.text).toMatch(/relatório/i);
    expect(pdf.text).toContain(`${MINUS}664,50`);
    expect(pdf.text).toContain(name('Ana'));
    expect(pdf.text).toContain(name('Casa B'));
    // uma transação conhecida (Rui · Casa A, primeiro depósito de 50,00 €)
    expect(pdf.text).toContain(`${name('Rui')} \u00b7 ${name('Casa A')}`);
    // a tabela de transações sai coluna a coluna (D-014): verifica-se cada campo, não a linha seguida
    expect(pdf.text).toContain(known.date);
    expect(pdf.text).toContain(known.amount);
    expect(pdf.text).toMatch(/\d+ MOVIMENTOS Transações/);

    await expect(page.getByRole('status')).toContainText('Relatório gerado: tento-relatorio-');
    await expect(page.getByRole('button', { name: 'Gerar PDF' })).toBeEnabled();
    // a política de segurança (CSP) não bloqueou nada na geração do PDF
    expect(cspViolations).toEqual([]);
  });

  test('o âmbito perfil + casa escolhido na página vai para o PDF', async ({ page }) => {
    await page.goto('/relatorios');
    await ready(page);
    await page.getByRole('combobox', { name: 'Perfil' }).click();
    await page.getByRole('option', { name: name('Ana') }).click();
    await page.getByRole('combobox', { name: 'Casa' }).click();
    await page.getByRole('option', { name: name('Casa A') }).click();
    await page.getByRole('radio', { name: 'Tudo' }).click();
    await expect(page).toHaveURL(/perfil=.*casa=|casa=.*perfil=/);
    await expect(page.getByRole('region', { name: 'Pré-visualização' })).toContainText(`${MINUS}512,30`);

    const { file } = await download(page, () => page.getByRole('button', { name: 'Gerar PDF' }).click());
    const pdf = await readPdfText(await file.path());
    expect(pdf.pages).toBeGreaterThanOrEqual(4);
    expect(pdf.text).toContain(`${MINUS}512,30`);
    expect(pdf.text).toContain(name('Ana'));
    expect(pdf.text).not.toContain(name('Rui'));
    expect(pdf.text).not.toContain(`${MINUS}664,50`);
  });

  test('"Exportar PDF" do Painel gera o relatório dos filtros atuais', async ({ page }) => {
    await page.goto('/?periodo=tudo');
    await expect(page.getByRole('region', { name: /Resultado líquido/ })).toContainText(`${MINUS}664,50`);
    const button = page.getByRole('button', { name: 'Exportar PDF' });
    await expect(button).toBeEnabled();

    const { file, ms } = await download(page, () => button.click());
    console.log(
      `[tempo] Painel: clique até descarregamento = ${String(ms)} ms (meta ${String(TARGET_MS)} ms)`,
    );
    expect(file.suggestedFilename()).toMatch(TODAY_FILE);
    const pdf = await readPdfText(await file.path());
    expect(pdf.pages).toBeGreaterThanOrEqual(4);
    expect(pdf.text).toContain(`${MINUS}664,50`);
    await expect(page.getByRole('status').filter({ hasText: 'Relatório gerado' })).toBeVisible();
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`1440 px, tema ${tema}: sem violações de acessibilidade`, async ({ page }) => {
      await setTheme(page, tema);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/relatorios');
      await ready(page);
      await expectNoAxeViolations(page);
      await shot(page, `etapa7-relatorios-1440-${tema === 'light' ? 'claro' : 'escuro'}`);
    });
  }

  test('390 px: sem violações, sem scroll horizontal', async ({ page }) => {
    await setTheme(page, 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/relatorios');
    await ready(page);
    await expectNoAxeViolations(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, 'etapa7-relatorios-390-claro');
  });
});

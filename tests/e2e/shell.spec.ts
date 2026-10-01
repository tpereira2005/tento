import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, setTheme } from './helpers';

const PAGES = [
  { path: '/', title: 'Painel' },
  { path: '/transacoes', title: 'Transações' },
  { path: '/importar', title: 'Importar' },
  { path: '/comparar', title: 'Comparar' },
  { path: '/relatorios', title: 'Relatórios' },
  { path: '/definicoes', title: 'Definições' },
] as const;

function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Principal' });
}

test.describe('navegação no ecrã grande', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'a barra superior só existe a partir de 768 px');
  });

  test('o Tab chega a todos os itens, o Enter navega e aria-current acompanha', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');

    const labels = ['Painel', 'Transações', 'Importar', 'Comparar', 'Relatórios', 'Definições'];
    const reached: string[] = [];
    for (let i = 0; i < 20 && reached.length < labels.length; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('nav') ? el.textContent.trim() : '';
      });
      if (labels.includes(name)) reached.push(name);
    }
    expect(reached).toEqual(labels);

    // o foco está no último item (Definições): Shift+Tab volta a Relatórios e o Enter navega
    await page.keyboard.press('Shift+Tab');
    await expect(nav(page).getByRole('link', { name: 'Relatórios' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/relatorios');
    await expect(page.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Relatórios' })).toHaveAttribute('aria-current', 'page');
    await expect(nav(page).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('a ligação para o conteúdo leva o foco para o conteúdo', async ({ page }) => {
    await page.goto('/transacoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar para o conteúdo' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#conteudo')).toBeFocused();
  });

  test('o menu da conta mostra o utilizador e fecha com Escape', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: /^Conta de / });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Dono de Teste')).toBeVisible();
    await expect(page.getByText('@tento.test')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('link', { name: 'Definições' }).last().click();
    await expect(page).toHaveURL('/definicoes');
  });
});

test.describe('navegação no móvel', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'os separadores de baixo só existem abaixo de 768 px');
  });

  test('separadores em baixo e menu Mais', async ({ page }) => {
    await page.goto('/');
    const tabs = nav(page);
    await expect(tabs.getByRole('link')).toHaveText(['Painel', 'Transações', 'Importar', 'Comparar']);
    await expect(tabs.getByRole('button', { name: 'Mais' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');

    await tabs.getByRole('link', { name: 'Importar' }).click();
    await expect(page).toHaveURL('/importar');
    await expect(tabs.getByRole('link', { name: 'Importar' })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current', 'page');

    await tabs.getByRole('button', { name: 'Mais' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mais' });
    await expect(sheet.getByRole('link', { name: 'Relatórios' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Definições' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await tabs.getByRole('button', { name: 'Mais' }).click();
    await sheet.getByRole('link', { name: 'Relatórios' }).click();
    await expect(page).toHaveURL('/relatorios');
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeVisible();
  });
});

test('cada página tem um h1 e o título do separador', async ({ page }) => {
  // Definições é da página de definições (feature própria); aqui só as páginas da estrutura
  for (const { path, title } of PAGES.filter((p) => p.path !== '/definicoes')) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} · Tento`);
  }
});

test('a página placeholder diz em que etapa chegam', async ({ page }) => {
  await page.goto('/relatorios');
  await expect(page.getByText('O relatório em PDF chega na etapa 7.')).toBeVisible();
});

test('uma rota desconhecida mostra o 404 com ligação para o início', async ({ page }) => {
  await page.goto('/isto-nao-existe');
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL('/');
});

for (const tema of ['light', 'dark'] as const) {
  test.describe(`acessibilidade (${tema})`, () => {
    for (const { path, title } of PAGES) {
      test(`${path} sem violações (WCAG 2.2 AA)`, async ({ page }) => {
        await setTheme(page, tema);
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
        await expectNoAxeViolations(page);
      });
    }
  });
}

test.describe('zoom a 200 %', () => {
  test.use({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 2 });

  for (const { path, title } of PAGES) {
    test(`${path} sem scroll horizontal e com navegação utilizável`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(nav(page).getByRole('link', { name: 'Transações' })).toBeVisible();
    });
  }

  test('os separadores em baixo continuam a navegar', async ({ page }) => {
    await page.goto('/');
    await nav(page).getByRole('link', { name: 'Comparar' }).click();
    await expect(page).toHaveURL('/comparar');
    await expect(nav(page).getByRole('link', { name: 'Comparar' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('largura de tablet (768 px)', () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test('a barra superior cabe sem scroll horizontal', async ({ page }) => {
    await page.goto('/');
    await expect(nav(page).getByRole('link', { name: 'Relatórios' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

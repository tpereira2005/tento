import { expect, test } from '@playwright/test';
import {
  expectNoAxeViolations,
  OWNER_STATE_FILE,
  readOwner,
  setTheme,
  signInAndWait,
  signInThroughUi,
} from './helpers';

test.describe('páginas públicas', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('o registo está fechado depois de existir o dono', async ({ page }) => {
    await page.goto('/registar');
    await expect(page.getByRole('heading', { level: 1, name: 'Registo fechado' })).toBeVisible();
    await expect(page.getByText('O registo está fechado — este Tento já tem dono.')).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Ir para a entrada' }).click();
    await expect(page).toHaveURL('/entrar');
  });

  test('rotas protegidas redirecionam para a entrada e guardam o destino', async ({ page }) => {
    await page.goto('/transacoes');
    await expect(page).toHaveURL('/entrar?redirect=%2Ftransacoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  });

  test('o formulário valida antes de falar com a API', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Indica o teu email.')).toBeVisible();
    await expect(page.getByText('Indica a tua palavra-passe.')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.getByLabel('Email').fill('isto-nao-e-email');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Indica um email válido', { exact: false })).toBeVisible();
  });

  test('mostrar e esconder a palavra-passe', async ({ page }) => {
    await page.goto('/entrar');
    const password = page.getByLabel('Palavra-passe', { exact: true });
    const toggle = page.getByRole('button', { name: 'Mostrar palavra-passe' });
    await expect(password).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('uma palavra-passe errada mostra o erro e fica na página', async ({ page }) => {
    const owner = readOwner();
    await page.goto('/entrar');
    await signInThroughUi(page, { ...owner, password: `${owner.password}-errada` });
    await expect(page.getByRole('alert')).toHaveText('Email ou palavra-passe incorretos.');
    await expect(page).toHaveURL('/entrar');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  test('entrar, terminar sessão e voltar ao sítio pedido', async ({ page, isMobile }) => {
    const owner = readOwner();

    await page.goto('/transacoes');
    await expect(page).toHaveURL('/entrar?redirect=%2Ftransacoes');
    await signInAndWait(page, owner, '/transacoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: 'Mais' }).click();
      await page
        .getByRole('dialog', { name: 'Mais' })
        .getByRole('button', { name: 'Terminar sessão' })
        .click();
    } else {
      await page.getByRole('button', { name: /^Conta de / }).click();
      await page.getByRole('button', { name: 'Terminar sessão' }).click();
    }
    await expect(page).toHaveURL('/entrar');

    await page.goto('/relatorios');
    await expect(page).toHaveURL('/entrar?redirect=%2Frelatorios');
    await signInAndWait(page, owner, '/relatorios');
    await expect(page.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeVisible();
  });

  for (const tema of ['light', 'dark'] as const) {
    for (const path of ['/entrar', '/registar']) {
      test(`${path} sem violações de acessibilidade (${tema})`, async ({ page }) => {
        await setTheme(page, tema);
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
        await expectNoAxeViolations(page);
      });
    }
  }

  test('zoom a 200 %: sem scroll horizontal na entrada', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 640, height: 800 },
      deviceScaleFactor: 2,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto('/entrar');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
  });
});

test.describe('com sessão', () => {
  test.use({ storageState: OWNER_STATE_FILE });

  test('entrar e registar redirecionam para o painel', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page).toHaveURL('/');
    await page.goto('/registar');
    await expect(page).toHaveURL('/');
  });
});

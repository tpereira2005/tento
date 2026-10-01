import { expect, test } from '@playwright/test';

// Com sessão (storageState do dono): o botão também guarda o tema na conta.
test.afterEach(async ({ page }) => {
  // deixa a conta como estava para os outros testes (a base de dados é partilhada)
  await page.request.patch('/api/me/settings', {
    data: { theme: 'system' },
    headers: { origin: 'http://localhost:4173' },
  });
});

test('o botão de tema alterna data-theme, persiste após recarregar e guarda na conta', async ({ page }) => {
  // cada teste tem um contexto novo, sem preferência local guardada
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/me/settings') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Mudar para tema escuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect((await saved).ok()).toBe(true);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const me = await page.request.get('/api/me');
  expect(((await me.json()) as { settings: { theme: string } }).settings.theme).toBe('dark');

  const savedLight = page.waitForResponse(
    (r) => r.url().endsWith('/api/me/settings') && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Mudar para tema claro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect((await savedLight).ok()).toBe(true);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('ao entrar aplica-se o tema guardado na conta', async ({ browser }) => {
  // conta com tema escuro, sessão nova sem preferência local
  const owner = await browser.newContext({ storageState: 'tests/e2e/.auth/owner.json' });
  const setup = await owner.newPage();
  await setup.goto('/');
  await setup.request.patch('/api/me/settings', {
    data: { theme: 'dark' },
    headers: { origin: 'http://localhost:4173' },
  });
  await owner.close();

  const fresh = await browser.newContext({
    storageState: 'tests/e2e/.auth/owner.json',
    colorScheme: 'light',
  });
  const page = await fresh.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await fresh.close();
});

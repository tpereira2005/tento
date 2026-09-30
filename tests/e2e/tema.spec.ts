import { expect, test } from '@playwright/test';

test('o botão de tema alterna data-theme e persiste após recarregar', async ({ page }) => {
  // cada teste tem um contexto novo, sem preferência guardada
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Mudar para tema escuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Mudar para tema claro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

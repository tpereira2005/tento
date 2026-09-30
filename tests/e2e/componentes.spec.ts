import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const tema of ['light', 'dark'] as const) {
  test.describe(`tema ${tema}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        localStorage.setItem('tento:tema', value);
      }, tema);
      await page.goto('/componentes');
      await expect(page.getByRole('heading', { level: 1, name: 'Componentes' })).toBeVisible();
    });

    test('sem violações de acessibilidade (WCAG 2.2 AA)', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test('não tem scroll horizontal', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('o diálogo abre e fecha com Escape', async ({ page }) => {
  await page.goto('/componentes');
  await page.getByRole('button', { name: 'Abrir diálogo' }).click();
  await expect(page.getByRole('dialog', { name: 'Apagar importação' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

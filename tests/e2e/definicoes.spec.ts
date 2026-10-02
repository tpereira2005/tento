import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { uniqueTag } from './tag';

/** Etiqueta única por execução: a BD é partilhada entre testes e projetos. */
const tag = uniqueTag();
/** A API rejeita escritas sem `Origin` da própria aplicação. */
const headers = { origin: 'http://localhost:4173' };
const name = (base: string) => `${base} ${tag}`;

interface Named {
  id: string;
  name: string;
}

async function list(request: APIRequestContext, kind: 'bookmakers' | 'profiles'): Promise<Named[]> {
  const res = await request.get(`/api/${kind}`);
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { items: Named[] }).items;
}

/** Apaga (em cascata) tudo o que este ficheiro criou. */
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
  await create('bookmakers', 'Casa B');
  const who = await create('profiles', 'Ana');
  const res = await request.post('/api/wallets', {
    data: { profileId: who.id, bookmakerId: house.id },
    headers,
  });
  expect(res.status()).toBe(201);
}

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('Definições', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test('cria casas, perfis e contas, renomeia, apaga e persiste', async ({ page }) => {
    await page.goto('/definicoes');
    await expect(page.getByRole('heading', { level: 1, name: 'Definições' })).toBeVisible();

    const casas = page.getByRole('region', { name: 'Casas' });
    const perfis = page.getByRole('region', { name: 'Perfis' });
    const contas = page.getByRole('region', { name: 'Contas' });
    await expect(casas.getByRole('button', { name: 'Adicionar casa' })).toBeVisible();

    // casas
    for (const base of ['Casa A', 'Casa B']) {
      await casas.getByLabel('Nome da casa').fill(name(base));
      await casas.getByRole('button', { name: 'Adicionar casa' }).click();
      await expect(casas.getByRole('listitem').filter({ hasText: name(base) })).toBeVisible();
      await expect(casas.getByLabel('Nome da casa')).toBeFocused();
    }

    // duplicado
    await casas.getByLabel('Nome da casa').fill(name('Casa A').toUpperCase());
    await casas.getByRole('button', { name: 'Adicionar casa' }).click();
    await expect(casas.getByText('Já existe uma casa com este nome.')).toBeVisible();
    await casas.getByLabel('Nome da casa').fill('');

    // perfis
    for (const base of ['Ana', 'Rui']) {
      await perfis.getByLabel('Nome do perfil').fill(name(base));
      await perfis.getByRole('button', { name: 'Adicionar perfil' }).click();
      await expect(perfis.getByRole('listitem').filter({ hasText: name(base) })).toBeVisible();
    }

    // contas: Ana·Casa A, Ana·Casa B, Rui·Casa A
    const pick = async (label: 'Perfil' | 'Casa', option: string) => {
      await contas.getByRole('combobox', { name: label }).click();
      await page.getByRole('option', { name: option }).click();
    };
    for (const [who, house] of [
      ['Ana', 'Casa A'],
      ['Ana', 'Casa B'],
      ['Rui', 'Casa A'],
    ] as const) {
      await pick('Perfil', name(who));
      await pick('Casa', name(house));
      await contas.getByRole('button', { name: 'Criar conta' }).click();
      await expect(
        contas.getByRole('listitem').filter({ hasText: `${name(who)} · ${name(house)}` }),
      ).toBeVisible();
    }
    // depois de criar, o formulário sugere a próxima combinação livre (Rui · Casa B)
    await expect(contas.getByText('Esta conta já existe.')).toHaveCount(0);
    await expect(contas.getByRole('button', { name: 'Criar conta' })).toBeEnabled();
    // escolher um perfil sem combinações livres mostra o aviso e não deixa repetir
    await pick('Perfil', name('Ana'));
    await expect(contas.getByText('Esta conta já existe.')).toBeVisible();
    await expect(contas.getByRole('button', { name: 'Criar conta' })).toBeDisabled();
    await expect(
      contas.getByRole('listitem').filter({ hasText: tag }).filter({ hasText: 'sem transações' }),
    ).toHaveCount(3);

    // renomear um perfil (Enter guarda)
    await perfis.getByRole('button', { name: `Renomear ${name('Rui')}` }).click();
    const input = perfis.getByRole('textbox', { name: `Renomear ${name('Rui')}` });
    await expect(input).toBeFocused();
    await input.fill(name('Rui Pinto'));
    await input.press('Enter');
    await expect(perfis.getByRole('listitem').filter({ hasText: name('Rui Pinto') })).toBeVisible();
    await expect(
      contas.getByRole('listitem').filter({ hasText: `${name('Rui Pinto')} · ${name('Casa A')}` }),
    ).toBeVisible();

    // Escape cancela a edição
    await perfis.getByRole('button', { name: `Renomear ${name('Ana')}` }).click();
    await page.keyboard.type('x');
    await page.keyboard.press('Escape');
    await expect(perfis.getByRole('listitem').filter({ hasText: name('Ana') })).toBeVisible();
    await expect(perfis.getByRole('button', { name: `Renomear ${name('Ana')}` })).toBeFocused();

    // apagar uma conta com confirmação
    const victim = `${name('Ana')} · ${name('Casa B')}`;
    await contas.getByRole('button', { name: `Apagar ${victim}` }).click();
    const dialog = page.getByRole('dialog', { name: `Apagar a conta ${victim}?` });
    await expect(dialog.getByText('Apaga também as transações desta conta.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(contas.getByRole('listitem').filter({ hasText: victim })).toBeVisible();
    await contas.getByRole('button', { name: `Apagar ${victim}` }).click();
    await page.getByRole('button', { name: 'Apagar conta' }).click();
    await expect(contas.getByRole('listitem').filter({ hasText: victim })).toHaveCount(0);

    // persiste após recarregar
    await page.reload();
    await expect(
      page
        .getByRole('region', { name: 'Contas' })
        .getByRole('listitem')
        .filter({ hasText: name('Casa A') }),
    ).toHaveCount(2);
    await expect(
      page
        .getByRole('region', { name: 'Casas' })
        .getByRole('listitem')
        .filter({ hasText: name('Casa B') }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Perfis' })
        .getByRole('listitem')
        .filter({ hasText: name('Rui Pinto') }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Contas' }).getByRole('listitem').filter({ hasText: victim }),
    ).toHaveCount(0);
  });

  test('apagar uma casa pede confirmação e leva as contas consigo', async ({ page, request }) => {
    await seed(request);
    await page.goto('/definicoes');
    const casas = page.getByRole('region', { name: 'Casas' });
    const contas = page.getByRole('region', { name: 'Contas' });
    await expect(contas.getByRole('listitem').filter({ hasText: name('Casa A') })).toBeVisible();

    await casas.getByRole('button', { name: `Apagar ${name('Casa A')}` }).click();
    const dialog = page.getByRole('dialog', { name: `Apagar ${name('Casa A')}?` });
    await expect(dialog.getByText('Apaga também as contas e as transações desta casa.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Apagar casa' }).click();
    await expect(casas.getByRole('listitem').filter({ hasText: name('Casa A') })).toHaveCount(0);
    await expect(contas.getByRole('listitem').filter({ hasText: name('Casa A') })).toHaveCount(0);
    await expect(casas.getByLabel('Nome da casa')).toBeFocused();
  });

  test('o tema escolhido na conta aplica-se e guarda-se', async ({ page }) => {
    await page.goto('/definicoes');
    const conta = page.getByRole('region', { name: 'Conta do utilizador' });
    await conta.getByRole('radio', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(conta.getByRole('radio', { name: 'Escuro' })).toBeChecked();
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Conta do utilizador' }).getByRole('radio', { name: 'Escuro' }),
    ).toBeChecked();
    await page
      .getByRole('region', { name: 'Conta do utilizador' })
      .getByRole('radio', { name: 'Sistema' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Conta do utilizador' }).getByRole('radio', { name: 'Sistema' }),
    ).toBeChecked();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: sem violações em ${scheme}`, async ({ page, request }) => {
      await seed(request);
      await page.addInitScript((value) => {
        localStorage.setItem('tento:tema', value);
      }, scheme);
      await page.goto('/definicoes');
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(
        page
          .getByRole('region', { name: 'Contas' })
          .getByRole('listitem')
          .filter({ hasText: name('Casa A') }),
      ).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('button', { name: `Apagar ${name('Casa B')}` }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('axe: sem violações a 390 px', async ({ page, request }) => {
    await seed(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/definicoes');
    await expect(
      page
        .getByRole('region', { name: 'Contas' })
        .getByRole('listitem')
        .filter({ hasText: name('Casa A') }),
    ).toBeVisible();
    await expectNoViolations(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

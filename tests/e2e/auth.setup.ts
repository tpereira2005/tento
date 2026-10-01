import { expect, test as setup } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  AUTH_DIR,
  OWNER_CREDENTIALS_FILE,
  OWNER_STATE_FILE,
  readOwner,
  signInThroughUi,
  type OwnerCredentials,
} from './helpers';

// Regista o dono pela interface com credenciais fictícias geradas agora (nunca no código nem nos registos)
// e guarda a sessão para os restantes testes.
setup('registar o dono e guardar a sessão', async ({ page }) => {
  mkdirSync(AUTH_DIR, { recursive: true });

  await page.goto('/registar');
  const closedMessage = page.getByText('este Tento já tem dono');
  await expect(closedMessage.or(page.getByLabel('Nome'))).toBeVisible();
  const closed = await closedMessage.isVisible();

  if (closed) {
    // Servidor reutilizado com a base de dados de uma execução anterior: entra com o dono já criado.
    if (!existsSync(OWNER_CREDENTIALS_FILE)) {
      throw new Error('O registo está fechado e faltam as credenciais guardadas. Reinicia o servidor E2E.');
    }
    await page.goto('/entrar');
    await signInThroughUi(page, readOwner());
  } else {
    const owner: OwnerCredentials = {
      name: 'Dono de Teste',
      email: `dono+${randomBytes(6).toString('hex')}@tento.test`,
      password: randomBytes(18).toString('base64url'),
    };
    writeFileSync(OWNER_CREDENTIALS_FILE, JSON.stringify(owner));

    await page.getByLabel('Nome').fill(owner.name);
    await page.getByLabel('Email').fill(owner.email);
    await page.getByLabel('Palavra-passe', { exact: true }).fill(owner.password);
    await page.getByLabel('Confirma a palavra-passe').fill(owner.password);
    await page.getByRole('button', { name: 'Criar conta' }).click();
  }

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeVisible();
  await page.context().storageState({ path: OWNER_STATE_FILE });
});

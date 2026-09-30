import type { Db } from './client';
import { DEMO_BOOKMAKERS, DEMO_PROFILES, DEMO_WALLETS, demoRows } from './demo-dataset';
import { commitImport } from './repos/imports';
import { createBookmaker } from './repos/bookmakers';
import { createProfile } from './repos/profiles';
import { createWallet } from './repos/wallets';

/**
 * Cria dados de demonstração (sintéticos) para um utilizador existente: casas Casa A/Casa B, perfis Ana/Rui,
 * três contas e 12 meses de movimentos. Falha se os nomes já existirem.
 */
export async function seedDemoData(db: Db, userId: string): Promise<{ walletIds: Record<string, string> }> {
  const bookmakerIds = new Map<string, string>();
  for (const name of DEMO_BOOKMAKERS) {
    const r = await createBookmaker(db, userId, { name });
    if (!r.ok) throw new Error(`seed: casa "${name}" não criada (${r.error})`);
    bookmakerIds.set(name, r.value.id);
  }
  const profileIds = new Map<string, string>();
  for (const name of DEMO_PROFILES) {
    const r = await createProfile(db, userId, { name });
    if (!r.ok) throw new Error(`seed: perfil "${name}" não criado (${r.error})`);
    profileIds.set(name, r.value.id);
  }

  const rows = demoRows();
  const walletIds: Record<string, string> = {};
  for (const w of DEMO_WALLETS) {
    const profileId = profileIds.get(w.profile);
    const bookmakerId = bookmakerIds.get(w.bookmaker);
    if (profileId === undefined || bookmakerId === undefined) throw new Error('seed: dados em falta');
    const created = await createWallet(db, userId, { profileId, bookmakerId });
    if (!created.ok) throw new Error(`seed: conta ${w.key} não criada (${created.error})`);
    walletIds[w.key] = created.value.id;
    const walletRows = rows[w.key];
    const imported = await commitImport(db, userId, {
      walletId: created.value.id,
      filename: `demo-${w.key}.csv`,
      fileSha256: 'demo'.padEnd(64, '0'),
      rowsTotal: walletRows.length,
      rowsInvalid: 0,
      rowsDuplicate: 0,
      rowsConflict: 0,
      rows: walletRows,
    });
    if (!imported.ok) throw new Error(`seed: import de ${w.key} falhou`);
  }
  return { walletIds };
}

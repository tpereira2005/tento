import { beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData } from './seed';
import { listBookmakers, listImports, listProfiles, listTransactions, listWallets } from './repos';
import { createTestDb } from './test-utils';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});

describe('seedDemoData', () => {
  it('cria casas, perfis, contas e o conjunto de 12 meses com os totais esperados', async () => {
    const { walletIds } = await seedDemoData(t.db, t.userA);
    expect((await listBookmakers(t.db, t.userA)).map((b) => b.name)).toEqual(['Casa A', 'Casa B']);
    expect((await listProfiles(t.db, t.userA)).map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect((await listWallets(t.db, t.userA)).map((w) => `${w.profileName}·${w.bookmakerName}`)).toEqual([
      'Ana·Casa A',
      'Ana·Casa B',
      'Rui·Casa A',
    ]);
    expect(await listImports(t.db, t.userA)).toHaveLength(3);

    const txns = await listTransactions(t.db, t.userA);
    const net = (id: string | undefined) =>
      txns
        .filter((x) => x.walletId === id)
        .reduce((s, x) => s + (x.type === 'withdrawal' ? x.amountCents : -x.amountCents), 0);
    expect(net(walletIds['ana-a'])).toBe(-51230);
    expect(net(walletIds['ana-b'])).toBe(-9520);
    expect(net(walletIds['rui-a'])).toBe(-5700);
    const sum = (type: 'deposit' | 'withdrawal') =>
      txns.filter((x) => x.type === type).reduce((s, x) => s + x.amountCents, 0);
    expect(sum('deposit')).toBe(428000);
    expect(sum('withdrawal')).toBe(361550);
    expect(txns.every((x) => x.amountCents > 0)).toBe(true);
  });

  it('falha se for corrido duas vezes para o mesmo utilizador; outro utilizador não é afetado', async () => {
    await seedDemoData(t.db, t.userA);
    await expect(seedDemoData(t.db, t.userA)).rejects.toThrow(/seed/);
    await seedDemoData(t.db, t.userB);
    expect(await listTransactions(t.db, t.userB)).toHaveLength(
      (await listTransactions(t.db, t.userA)).length,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { seedDemoData } from '../db/seed';
import { createCatalog, createTestApp } from '../test-app';

interface Row {
  id: string;
  netCents: number;
}
interface Dashboard {
  summary: {
    netCents: number;
    depositedCents: number;
    withdrawnCents: number;
    positiveMonths: number;
    daysSinceLastDeposit: number | null;
  };
  monthly: { month: string }[];
  streaks: unknown;
  heatmap: { date: string }[];
  breakdown: { wallet: Row[]; profile: Row[]; bookmaker: Row[] };
  insights: { id: string }[];
}

describe('/api/stats/dashboard', () => {
  it('devolve os números certos para os dados de demonstração', async () => {
    const t = await createTestApp();
    const a = await t.signUp('demo@exemplo.test', 'Demo');
    const { walletIds } = await seedDemoData(t.db, a.userId);

    const res = await a.json<Dashboard>('GET', '/api/stats/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      netCents: -66_450,
      depositedCents: 428_000,
      withdrawnCents: 361_550,
      positiveMonths: 5,
    });
    expect(res.body.monthly).toHaveLength(12);
    expect(res.body.insights.length).toBeGreaterThan(0);

    const nets = Object.fromEntries(res.body.breakdown.wallet.map((r) => [r.id, r.netCents]));
    expect(nets[walletIds['ana-a'] ?? '']).toBe(-51_230);
    expect(nets[walletIds['ana-b'] ?? '']).toBe(-9_520);
    expect(nets[walletIds['rui-a'] ?? '']).toBe(-5_700);
    expect(res.body.breakdown.profile).toHaveLength(2);
    expect(res.body.breakdown.bookmaker).toHaveLength(2);
  });

  it('o mapa de calor cobre os últimos 12 meses até hoje (relógio fixo)', async () => {
    const t = await createTestApp();
    const a = await t.signUp('demo@exemplo.test');
    await seedDemoData(t.db, a.userId);
    const res = await a.json<Dashboard>('GET', '/api/stats/dashboard');
    expect(res.body.heatmap[0]?.date).toBe('2025-07-01');
    expect(res.body.heatmap.at(-1)?.date).toBe('2026-06-15');
    expect(res.body.summary.daysSinceLastDeposit).not.toBeNull();
  });

  it('aplica os filtros de conta, perfil, casa e datas', async () => {
    const t = await createTestApp();
    const a = await t.signUp('demo@exemplo.test');
    const { walletIds } = await seedDemoData(t.db, a.userId);
    const wallets = (
      await a.json<{ items: { id: string; profileId: string; bookmakerId: string }[] }>('GET', '/api/wallets')
    ).body.items;
    const anaB = wallets.find((w) => w.id === walletIds['ana-b']);

    const one = await a.json<Dashboard>('GET', `/api/stats/dashboard?walletIds=${walletIds['ana-b'] ?? ''}`);
    expect(one.body.summary.netCents).toBe(-9_520);
    const profile = await a.json<Dashboard>(
      'GET',
      `/api/stats/dashboard?profileIds=${anaB?.profileId ?? ''}`,
    );
    expect(profile.body.summary.netCents).toBe(-51_230 - 9_520);
    const book = await a.json<Dashboard>(
      'GET',
      `/api/stats/dashboard?bookmakerIds=${anaB?.bookmakerId ?? ''}`,
    );
    expect(book.body.summary.netCents).toBe(-9_520);
    const range = await a.json<Dashboard>('GET', '/api/stats/dashboard?from=2025-10-01&to=2025-12-31');
    expect(range.body.monthly).toHaveLength(3);
    expect(range.body.heatmap[0]?.date).toBe('2025-10-01');
    expect(range.body.heatmap.at(-1)?.date).toBe('2025-12-31');
    const toOnly = await a.json<Dashboard>('GET', '/api/stats/dashboard?to=2025-12-31');
    expect(toOnly.body.heatmap[0]?.date).toBe('2025-01-01');
    expect((await a.json('GET', '/api/stats/dashboard?from=2025-13-01')).status).toBe(422);
  });

  it('sem dados devolve zeros', async () => {
    const t = await createTestApp();
    const a = await t.signUp('ana@exemplo.test');
    await createCatalog(a);
    const res = await a.json<Dashboard>('GET', '/api/stats/dashboard');
    expect(res.body.summary.netCents).toBe(0);
    expect(res.body.monthly).toEqual([]);
    expect(res.body.insights).toEqual([]);
  });

  it('isolamento: outro utilizador não conta com os dados alheios', async () => {
    const t = await createTestApp('open');
    const a = await t.signUp('demo@exemplo.test');
    const b = await t.signUp('rui@exemplo.test');
    const { walletIds } = await seedDemoData(t.db, a.userId);

    const other = await b.json<Dashboard>('GET', '/api/stats/dashboard');
    expect(other.body.summary).toMatchObject({ netCents: 0, depositedCents: 0, withdrawnCents: 0 });
    expect(other.body.breakdown.wallet).toEqual([]);
    const probe = await b.json<Dashboard>(
      'GET',
      `/api/stats/dashboard?walletIds=${walletIds['ana-a'] ?? ''}`,
    );
    expect(probe.body.summary.netCents).toBe(0);
    expect(probe.body.monthly).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { acceptanceTransactions, acceptanceWallets, makeTxn } from '../stats/acceptance.test.fixture';
import type { IsoDate, MonthKey, Transaction } from '../types';
import { generateInsights, type Insight, type InsightContext } from './insights';

const d = (s: string) => s as IsoDate;
const m = (s: string) => s as MonthKey;

/** Constrói uma série a partir de [mês, depósitos, levantamentos] em cêntimos. */
function series(rows: [string, number, number][]): Transaction[] {
  const out: Transaction[] = [];
  let seq = 0;
  for (const [month, dep, wd] of rows) {
    if (dep > 0) out.push(makeTxn(seq++, 'w-ana-a', `${month}-05`, 'deposit', dep));
    if (wd > 0) out.push(makeTxn(seq++, 'w-ana-a', `${month}-15`, 'withdrawal', wd));
  }
  return out;
}

const run = (txns: Transaction[], today = '2026-12-31', extra: Partial<InsightContext> = {}): Insight[] =>
  generateInsights({ txns, wallets: acceptanceWallets, today: d(today), ...extra }, { max: 100 });
const ids = (xs: Insight[]) => xs.map((i) => i.id);

describe('generateInsights no conjunto de aceitação', () => {
  const ctx: InsightContext = {
    txns: acceptanceTransactions(),
    wallets: acceptanceWallets,
    today: d('2026-09-30'),
  };
  it('gera os destaques esperados por prioridade', () => {
    const all = generateInsights(ctx, { max: 100 });
    expect(ids(all)).toEqual([
      'worst_month',
      'deposits_change_vs_prev_month',
      'last3_vs_prev3',
      'withdrawn_ratio',
    ]);
    const dep = all.find((i) => i.id === 'deposits_change_vs_prev_month');
    expect(dep?.tone).toBe('negative');
    expect(dep?.params).toMatchObject({ month: '2026-09', depositedCents: 51500, prevDepositedCents: 31500 });
    expect(dep?.params.ratio).toBeCloseTo(0.6349, 4);
    expect(all.find((i) => i.id === 'worst_month')?.params).toEqual({ month: '2026-09', netCents: -28450 });
    expect(all.find((i) => i.id === 'last3_vs_prev3')?.params).toEqual({
      last3NetCents: -50950,
      prev3NetCents: -17500,
    });
    expect(all.find((i) => i.id === 'last3_vs_prev3')?.tone).toBe('negative');
    expect(all.find((i) => i.id === 'withdrawn_ratio')?.tone).toBe('neutral');
  });
  it('por omissão devolve 3', () => {
    expect(generateInsights(ctx)).toHaveLength(3);
    expect(generateInsights(ctx, { max: 0 })).toEqual([]);
  });
  it('é determinístico', () => {
    expect(generateInsights(ctx, { max: 100 })).toEqual(generateInsights(ctx, { max: 100 }));
  });
});

describe('regras individuais', () => {
  it('sem dados: nada', () => {
    expect(run([])).toEqual([]);
  });

  it('worst_month: dispara e não dispara', () => {
    const yes = run(
      series([
        ['2026-01', 100, 50],
        ['2026-02', 500, 10],
      ]),
    );
    expect(ids(yes)).toContain('worst_month');
    const notLast = run(
      series([
        ['2026-01', 500, 10],
        ['2026-02', 100, 50],
      ]),
    );
    expect(ids(notLast)).not.toContain('worst_month');
    const single = run(series([['2026-01', 500, 10]]));
    expect(ids(single)).not.toContain('worst_month');
    const tie = run(
      series([
        ['2026-01', 500, 0],
        ['2026-02', 500, 0],
      ]),
    );
    expect(ids(tie)).not.toContain('worst_month');
    const positiveWorst = run(
      series([
        ['2026-01', 100, 900],
        ['2026-02', 100, 300],
      ]),
    );
    expect(ids(positiveWorst)).not.toContain('worst_month');
  });

  it('best_month: dispara e não dispara', () => {
    const yes = run(
      series([
        ['2026-01', 100, 50],
        ['2026-02', 100, 900],
      ]),
    );
    const bm = yes.find((i) => i.id === 'best_month');
    expect(bm).toMatchObject({ tone: 'positive', params: { month: '2026-02', netCents: 800 } });
    const notLast = run(
      series([
        ['2026-01', 100, 900],
        ['2026-02', 100, 50],
      ]),
    );
    expect(ids(notLast)).not.toContain('best_month');
    const negBest = run(
      series([
        ['2026-01', 900, 0],
        ['2026-02', 300, 0],
      ]),
    );
    expect(ids(negBest)).not.toContain('best_month');
  });

  it('deposits_change_vs_prev_month: subida, descida, abaixo do limiar e base nula', () => {
    const up = run(
      series([
        ['2026-01', 1000, 0],
        ['2026-02', 1250, 0],
      ]),
    );
    expect(up.find((i) => i.id === 'deposits_change_vs_prev_month')).toMatchObject({
      tone: 'negative',
      params: { ratio: 0.25 },
    });
    const down = run(
      series([
        ['2026-01', 1000, 0],
        ['2026-02', 600, 0],
      ]),
    );
    expect(down.find((i) => i.id === 'deposits_change_vs_prev_month')).toMatchObject({ tone: 'positive' });
    const small = run(
      series([
        ['2026-01', 1000, 0],
        ['2026-02', 1249, 0],
      ]),
    );
    expect(ids(small)).not.toContain('deposits_change_vs_prev_month');
    const zeroPrev = run(
      series([
        ['2026-01', 0, 100],
        ['2026-02', 1000, 0],
      ]),
    );
    expect(ids(zeroPrev)).not.toContain('deposits_change_vs_prev_month');
    const oneMonth = run(series([['2026-02', 1000, 0]]));
    expect(ids(oneMonth)).not.toContain('deposits_change_vs_prev_month');
  });

  it('last3_vs_prev3: precisa de 6 meses; tons', () => {
    const base: [string, number, number][] = [
      ['2026-01', 100, 0],
      ['2026-02', 100, 0],
      ['2026-03', 100, 0],
      ['2026-04', 100, 0],
      ['2026-05', 100, 0],
    ];
    expect(ids(run(series(base)))).not.toContain('last3_vs_prev3');
    const better = run(series(base), '2026-12-31', { to: m('2026-06') });
    expect(better.find((i) => i.id === 'last3_vs_prev3')).toMatchObject({
      tone: 'positive',
      params: { last3NetCents: -200, prev3NetCents: -300 },
    });
    const worse = run(series([...base, ['2026-06', 500, 0]]));
    expect(worse.find((i) => i.id === 'last3_vs_prev3')?.tone).toBe('negative');
    const equal = run(series([...base, ['2026-06', 100, 0]]));
    expect(equal.find((i) => i.id === 'last3_vs_prev3')?.tone).toBe('neutral');
  });

  it('negative_streak e positive_streak: dispara com 3, não com 2', () => {
    const neg3 = run(
      series([
        ['2026-01', 100, 0],
        ['2026-02', 100, 0],
        ['2026-03', 100, 0],
      ]),
    );
    expect(neg3.find((i) => i.id === 'negative_streak')).toMatchObject({
      tone: 'negative',
      params: { months: 3, startMonth: '2026-01' },
    });
    expect(ids(neg3)).not.toContain('positive_streak');
    const pos3 = run(
      series([
        ['2026-01', 0, 100],
        ['2026-02', 0, 100],
        ['2026-03', 0, 100],
        ['2026-04', 0, 100],
      ]),
    );
    expect(pos3.find((i) => i.id === 'positive_streak')).toMatchObject({
      tone: 'positive',
      params: { months: 4, startMonth: '2026-01' },
    });
    expect(ids(pos3)).not.toContain('negative_streak');
    const neg2 = run(
      series([
        ['2026-01', 0, 100],
        ['2026-02', 100, 0],
        ['2026-03', 100, 0],
      ]),
    );
    expect(ids(neg2)).not.toContain('negative_streak');
    const zeroEnd = run(
      series([
        ['2026-01', 100, 0],
        ['2026-02', 100, 0],
      ]),
      '2026-12-31',
      { to: m('2026-05') },
    );
    expect(ids(zeroEnd)).not.toContain('negative_streak');
  });

  it('days_since_last_deposit: 30 dispara, 29 não', () => {
    const t = series([['2026-09', 100, 0]]); // depósito em 2026-09-05
    const yes = run(t, '2026-10-05');
    expect(yes.find((i) => i.id === 'days_since_last_deposit')).toMatchObject({
      tone: 'positive',
      params: { days: 30, date: '2026-09-05' },
    });
    expect(ids(run(t, '2026-10-04'))).not.toContain('days_since_last_deposit');
    expect(ids(run(series([['2026-09', 0, 100]]), '2026-12-31'))).not.toContain('days_since_last_deposit');
  });

  it('withdrawn_ratio: com depósitos e sem depósitos', () => {
    const yes = run(series([['2026-01', 1000, 500]]));
    expect(yes.find((i) => i.id === 'withdrawn_ratio')).toEqual({
      id: 'withdrawn_ratio',
      tone: 'neutral',
      priority: 10,
      params: { ratio: 0.5, depositedCents: 1000, withdrawnCents: 500 },
    });
    expect(ids(run(series([['2026-01', 0, 500]])))).not.toContain('withdrawn_ratio');
  });

  it('respeita from/to e ordena por prioridade e id', () => {
    const t = series([
      ['2026-01', 100, 900],
      ['2026-02', 1000, 0],
      ['2026-03', 100, 50],
    ]);
    const r = run(t, '2026-03-10', { from: m('2026-02'), to: m('2026-03') });
    expect(ids(r)).toEqual(['deposits_change_vs_prev_month', 'withdrawn_ratio']);
    const priorities = r.map((i) => i.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });
});

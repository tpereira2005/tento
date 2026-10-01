import { describe, expect, it } from 'vitest';
import type { IsoDate, MonthKey, Transaction } from '../types';
import { acceptanceTransactions, acceptanceWallets, makeTxn } from './acceptance.test.fixture';
import { breakdown, UNKNOWN_ID } from './breakdown';
import {
  comparePeriods,
  fillMonths,
  monthlyAligned,
  previousMonthsPeriod,
  previousPeriod,
  samePeriodLastYear,
} from './compare';
import { filterTransactions } from './filter';
import { depositHeatmap } from './heatmap';
import { monthlySeries, type MonthlyPoint } from './monthly';
import { computeStreaks } from './streaks';
import { divRoundHalfAwayFromZero, summarize } from './summary';

const d = (s: string) => s as IsoDate;
const m = (s: string) => s as MonthKey;

describe('filterTransactions', () => {
  const txns = acceptanceTransactions();
  it('sem critérios devolve tudo', () => {
    expect(filterTransactions(txns, acceptanceWallets)).toHaveLength(txns.length);
    expect(filterTransactions(txns, acceptanceWallets, {})).toEqual(txns);
  });
  it('filtra por conta, perfil e casa', () => {
    const byWallet = filterTransactions(txns, acceptanceWallets, { walletIds: ['w-rui-a'] });
    expect(byWallet.length).toBeGreaterThan(0);
    expect(byWallet.every((t) => t.walletId === 'w-rui-a')).toBe(true);
    const byProfile = filterTransactions(txns, acceptanceWallets, { profileIds: ['ana'] });
    expect(byProfile.every((t) => t.walletId !== 'w-rui-a')).toBe(true);
    const byBook = filterTransactions(txns, acceptanceWallets, { bookmakerIds: ['casa-b'] });
    expect(byBook.every((t) => t.walletId === 'w-ana-b')).toBe(true);
    const both = filterTransactions(txns, acceptanceWallets, {
      profileIds: ['ana'],
      bookmakerIds: ['casa-a'],
    });
    expect(both.every((t) => t.walletId === 'w-ana-a')).toBe(true);
  });
  it('datas são inclusivas', () => {
    const r = filterTransactions(txns, acceptanceWallets, { from: d('2025-10-05'), to: d('2025-10-10') });
    expect(r.map((t) => t.date)).toEqual(['2025-10-05', '2025-10-10']);
    expect(filterTransactions(txns, acceptanceWallets, { from: d('2026-09-28') })).toHaveLength(1);
    expect(filterTransactions(txns, acceptanceWallets, { to: d('2025-10-05') })).toHaveLength(1);
  });
  it('contas desconhecidas saem quando se filtra por perfil ou casa', () => {
    const extra = [makeTxn(99, 'ghost', '2025-10-06', 'deposit', 100)];
    expect(filterTransactions(extra, acceptanceWallets, { profileIds: ['ana'] })).toEqual([]);
    expect(filterTransactions(extra, acceptanceWallets, { bookmakerIds: ['casa-a'] })).toEqual([]);
    expect(filterTransactions(extra, acceptanceWallets, { walletIds: ['ghost'] })).toEqual(extra);
  });
});

describe('monthlySeries', () => {
  it('vazio sem limites devolve []', () => {
    expect(monthlySeries([])).toEqual([]);
    expect(monthlySeries([], { from: m('2026-01') })).toEqual([]);
  });
  it('vazio com ambos os limites devolve meses a zeros', () => {
    const s = monthlySeries([], { from: m('2025-12'), to: m('2026-02') });
    expect(s.map((p) => p.month)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(s.every((p) => p.netCents === 0 && p.cumulativeCents === 0 && p.depositCount === 0)).toBe(true);
  });
  it('inclui meses vazios e acumula por ordem', () => {
    const t: Transaction[] = [
      makeTxn(1, 'a', '2026-01-10', 'deposit', 1000),
      makeTxn(2, 'a', '2026-03-05', 'withdrawal', 2500),
      makeTxn(3, 'a', '2026-03-06', 'deposit', 500),
    ];
    const s = monthlySeries(t);
    expect(s.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(s[1]).toEqual({
      month: '2026-02',
      depositedCents: 0,
      withdrawnCents: 0,
      netCents: 0,
      cumulativeCents: -1000,
      depositCount: 0,
      withdrawalCount: 0,
    });
    expect(s[2]).toMatchObject({
      depositedCents: 500,
      withdrawnCents: 2500,
      netCents: 2000,
      cumulativeCents: 1000,
      depositCount: 1,
      withdrawalCount: 1,
    });
  });
  it('respeita limites e ignora transações fora deles', () => {
    const t: Transaction[] = [
      makeTxn(1, 'a', '2025-12-31', 'deposit', 1000),
      makeTxn(2, 'a', '2026-01-10', 'deposit', 300),
      makeTxn(3, 'a', '2026-05-10', 'deposit', 700),
    ];
    const s = monthlySeries(t, { from: m('2026-01'), to: m('2026-02') });
    expect(s.map((p) => p.depositedCents)).toEqual([300, 0]);
    expect(s[1]?.cumulativeCents).toBe(-300);
  });
  it('conjunto de aceitação', () => {
    const s = monthlySeries(acceptanceTransactions());
    expect(s).toHaveLength(12);
    expect(s[0]?.month).toBe('2025-10');
    expect(s[11]?.month).toBe('2026-09');
    expect(s[11]?.cumulativeCents).toBe(-66450);
    expect(s[5]?.month).toBe('2026-03');
    expect(s[5]?.cumulativeCents).toBe(2000);
    expect(s[11]?.depositedCents).toBe(51500);
    expect(s[11]?.withdrawnCents).toBe(23050);
  });
});

describe('summarize', () => {
  const today = d('2026-09-30');
  it('conjunto de aceitação', () => {
    const s = summarize(acceptanceTransactions(), { today });
    expect(s.depositedCents).toBe(428000);
    expect(s.withdrawnCents).toBe(361550);
    expect(s.netCents).toBe(-66450);
    expect(s.depositCount).toBe(24);
    expect(s.withdrawalCount).toBe(24);
    expect(s.months).toBe(12);
    expect(s.positiveMonths).toBe(5);
    expect(s.negativeMonths).toBe(7);
    expect(s.zeroMonths).toBe(0);
    expect(s.bestMonth).toEqual({ month: '2026-03', netCents: 31000 });
    expect(s.worstMonth).toEqual({ month: '2026-09', netCents: -28450 });
    expect(s.avgMonthlyNetCents).toBe(-5538);
    expect(s.withdrawnRatio).toBeCloseTo(0.8447, 4);
    expect(s.lastDeposit).toEqual({ date: '2026-09-28', amountCents: 25750 });
    expect(s.daysSinceLastDeposit).toBe(2);
  });
  it('vazio', () => {
    const s = summarize([], { today });
    expect(s).toMatchObject({
      depositedCents: 0,
      months: 0,
      withdrawnRatio: null,
      avgMonthlyNetCents: 0,
      bestMonth: null,
      worstMonth: null,
      lastDeposit: null,
      daysSinceLastDeposit: null,
    });
  });
  it('só levantamentos: razão nula, sem último depósito; meses a zero contam', () => {
    const t = [
      makeTxn(1, 'a', '2026-01-10', 'withdrawal', 1000),
      makeTxn(2, 'a', '2026-03-10', 'deposit', 0),
    ];
    const s = summarize(t, { today, to: m('2026-04') });
    expect(s.months).toBe(4);
    expect(s.zeroMonths).toBe(3);
    expect(s.positiveMonths).toBe(1);
    expect(s.withdrawnRatio).toBeNull();
    expect(s.lastDeposit).toEqual({ date: '2026-03-10', amountCents: 0 });
  });
  it('empates de melhor/pior mês ficam com o mais antigo', () => {
    const t = [
      makeTxn(1, 'a', '2026-01-10', 'withdrawal', 500),
      makeTxn(2, 'a', '2026-02-10', 'withdrawal', 500),
      makeTxn(3, 'a', '2026-03-10', 'deposit', 200),
      makeTxn(4, 'a', '2026-04-10', 'deposit', 200),
    ];
    const s = summarize(t, { today });
    expect(s.bestMonth?.month).toBe('2026-01');
    expect(s.worstMonth?.month).toBe('2026-03');
  });
  it('último depósito: data mais recente, depois seq mais alto; ignora fora do intervalo', () => {
    const t = [
      makeTxn(1, 'a', '2026-01-10', 'deposit', 100),
      makeTxn(5, 'a', '2026-01-20', 'deposit', 500),
      makeTxn(3, 'a', '2026-01-20', 'deposit', 300),
      makeTxn(2, 'a', '2026-01-20', 'withdrawal', 900),
      makeTxn(7, 'a', '2026-06-20', 'deposit', 900),
    ];
    const s = summarize(t, { today, from: m('2026-01'), to: m('2026-02') });
    expect(s.lastDeposit).toEqual({ date: '2026-01-20', amountCents: 500 });
    const before = summarize([makeTxn(1, 'a', '2025-01-10', 'deposit', 100)], {
      today,
      from: m('2026-01'),
      to: m('2026-02'),
    });
    expect(before.lastDeposit).toBeNull();
  });
  it('arredondamento da média: metade afasta-se de zero', () => {
    expect(divRoundHalfAwayFromZero(-66450, 12)).toBe(-5538);
    expect(divRoundHalfAwayFromZero(66450, 12)).toBe(5538);
    expect(divRoundHalfAwayFromZero(-5, 10)).toBe(-1);
    expect(divRoundHalfAwayFromZero(-4, 10)).toBe(0);
    expect(divRoundHalfAwayFromZero(7, -2)).toBe(-4);
    expect(divRoundHalfAwayFromZero(10, 5)).toBe(2);
  });
});

describe('computeStreaks', () => {
  const t = (month: string, type: 'deposit' | 'withdrawal', amount: number, seq: number) =>
    makeTxn(seq, 'a', `${month}-10`, type, amount);
  it('vazio', () => {
    expect(computeStreaks([])).toEqual({ current: null, longestPositive: null, longestNegative: null });
  });
  it('sequências, zeros interrompem e empates ficam com a mais antiga', () => {
    const txns = [
      t('2026-01', 'withdrawal', 100, 1),
      t('2026-02', 'withdrawal', 100, 2),
      t('2026-03', 'deposit', 100, 3),
      t('2026-04', 'deposit', 100, 4),
      t('2026-05', 'deposit', 100, 5),
      // junho vazio: zero
      t('2026-07', 'withdrawal', 100, 6),
      t('2026-08', 'withdrawal', 100, 7),
      t('2026-09', 'withdrawal', 100, 8),
      t('2026-10', 'deposit', 100, 9),
      t('2026-11', 'deposit', 100, 10),
      t('2026-12', 'deposit', 100, 11),
    ];
    const s = computeStreaks(txns);
    expect(s.current).toEqual({ sign: 'negative', length: 3, start: '2026-10', end: '2026-12' });
    expect(s.longestNegative).toEqual({ sign: 'negative', length: 3, start: '2026-03', end: '2026-05' });
    expect(s.longestPositive).toEqual({ sign: 'positive', length: 3, start: '2026-07', end: '2026-09' });
  });
  it('sequência atual a zero e sem negativos', () => {
    const s = computeStreaks([t('2026-01', 'withdrawal', 100, 1)], { to: m('2026-03') });
    expect(s.current).toEqual({ sign: 'zero', length: 2, start: '2026-02', end: '2026-03' });
    expect(s.longestNegative).toBeNull();
    expect(s.longestPositive?.length).toBe(1);
  });
  it('conjunto de aceitação: meses alternados', () => {
    const s = computeStreaks(acceptanceTransactions());
    expect(s.current).toEqual({ sign: 'negative', length: 1, start: '2026-09', end: '2026-09' });
    expect(s.longestPositive?.length).toBe(1);
  });
});

describe('depositHeatmap', () => {
  it('cobre todos os dias e usa nível 0 sem depósitos', () => {
    const cells = depositHeatmap([], { from: d('2026-02-27'), to: d('2026-03-02') });
    expect(cells.map((c) => c.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(cells.every((c) => c.level === 0 && c.depositedCents === 0)).toBe(true);
  });
  it('intervalo invertido devolve []', () => {
    expect(depositHeatmap([], { from: d('2026-03-02'), to: d('2026-03-01') })).toEqual([]);
  });
  it('valores todos iguais dão nível 2; levantamentos e datas fora são ignorados', () => {
    const t = [
      makeTxn(1, 'a', '2026-03-01', 'deposit', 500),
      makeTxn(2, 'a', '2026-03-02', 'deposit', 500),
      makeTxn(3, 'a', '2026-03-02', 'withdrawal', 9999),
      makeTxn(4, 'a', '2026-04-02', 'deposit', 9999),
      makeTxn(5, 'a', '2026-02-02', 'deposit', 9999),
    ];
    const c = depositHeatmap(t, { from: d('2026-03-01'), to: d('2026-03-03') });
    expect(c.map((x) => x.level)).toEqual([2, 2, 0]);
  });
  it('quartis: 1 a 4 de forma determinística, somando depósitos do mesmo dia', () => {
    const t = [
      makeTxn(1, 'a', '2026-03-01', 'deposit', 100),
      makeTxn(2, 'a', '2026-03-02', 'deposit', 200),
      makeTxn(3, 'a', '2026-03-03', 'deposit', 300),
      makeTxn(4, 'a', '2026-03-04', 'deposit', 400),
      makeTxn(5, 'a', '2026-03-04', 'deposit', 400),
    ];
    const c = depositHeatmap(t, { from: d('2026-03-01'), to: d('2026-03-05') });
    expect(c.map((x) => x.level)).toEqual([1, 2, 3, 4, 0]);
    expect(c[3]?.depositedCents).toBe(800);
  });
  it('mais valores do que níveis: valores repetidos ficam no mesmo nível', () => {
    const vals = [100, 100, 100, 100, 100, 100, 100, 1000];
    const t = vals.map((v, i) => makeTxn(i, 'a', `2026-03-0${String(i + 1)}`, 'deposit', v));
    const c = depositHeatmap(t, { from: d('2026-03-01'), to: d('2026-03-08') });
    expect(c.map((x) => x.level)).toEqual([1, 1, 1, 1, 1, 1, 1, 4]);
  });
});

describe('breakdown', () => {
  const txns = [...acceptanceTransactions(), makeTxn(500, 'ghost', '2026-09-01', 'deposit', 1000)];
  it('por conta: ordenado por |líquido| e com quota', () => {
    const rows = breakdown(acceptanceTransactions(), acceptanceWallets, 'wallet');
    expect(rows.map((r) => r.id)).toHaveLength(3);
    const total = rows.reduce((a, r) => a + r.netCents, 0);
    expect(total).toBe(-66450);
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 10);
    for (let i = 1; i < rows.length; i++) {
      expect(Math.abs(rows[i - 1]?.netCents ?? 0)).toBeGreaterThanOrEqual(Math.abs(rows[i]?.netCents ?? 0));
    }
  });
  it('três contas com líquidos -51230, -9520 e -5700', () => {
    const t = [
      makeTxn(1, 'w-ana-a', '2026-01-01', 'deposit', 60000),
      makeTxn(2, 'w-ana-a', '2026-01-02', 'withdrawal', 8770),
      makeTxn(3, 'w-ana-b', '2026-01-01', 'deposit', 9520),
      makeTxn(4, 'w-rui-a', '2026-01-01', 'deposit', 5700),
    ];
    const rows = breakdown(t, acceptanceWallets, 'wallet');
    expect(rows.map((r) => [r.id, r.netCents])).toEqual([
      ['w-ana-a', -51230],
      ['w-ana-b', -9520],
      ['w-rui-a', -5700],
    ]);
    expect(rows[0]?.share).toBeCloseTo(51230 / 66450, 10);
    const byProfile = breakdown(t, acceptanceWallets, 'profile');
    expect(byProfile.map((r) => [r.id, r.netCents])).toEqual([
      ['ana', -60750],
      ['rui', -5700],
    ]);
    const byBook = breakdown(t, acceptanceWallets, 'bookmaker');
    expect(byBook.map((r) => [r.id, r.netCents])).toEqual([
      ['casa-a', -56930],
      ['casa-b', -9520],
    ]);
  });
  it('contas desconhecidas e empates por id', () => {
    const rows = breakdown(txns, acceptanceWallets, 'profile');
    expect(rows.some((r) => r.id === UNKNOWN_ID && r.netCents === -1000)).toBe(true);
    const tie = [
      makeTxn(1, 'w-rui-a', '2026-01-01', 'deposit', 100),
      makeTxn(2, 'w-ana-a', '2026-01-01', 'deposit', 100),
      makeTxn(3, 'w-ana-b', '2026-01-01', 'deposit', 300),
    ];
    expect(breakdown(tie, acceptanceWallets, 'wallet').map((r) => r.id)).toEqual([
      'w-ana-b',
      'w-ana-a',
      'w-rui-a',
    ]);
  });
  it('total zero dá quota 0; vazio dá []', () => {
    const z = [
      makeTxn(1, 'w-ana-a', '2026-01-01', 'deposit', 100),
      makeTxn(2, 'w-ana-a', '2026-01-02', 'withdrawal', 100),
    ];
    expect(breakdown(z, acceptanceWallets, 'wallet')).toEqual([
      { id: 'w-ana-a', depositedCents: 100, withdrawnCents: 100, netCents: 0, share: 0 },
    ]);
    expect(breakdown([], acceptanceWallets, 'wallet')).toEqual([]);
  });
});

describe('comparePeriods / previousPeriod', () => {
  it('previousPeriod tem a mesma duração, imediatamente antes', () => {
    expect(previousPeriod({ from: d('2026-03-01'), to: d('2026-03-31') })).toEqual({
      from: '2026-01-29',
      to: '2026-02-28',
    });
    expect(previousPeriod({ from: d('2026-01-01'), to: d('2026-01-01') })).toEqual({
      from: '2025-12-31',
      to: '2025-12-31',
    });
  });
  it('compara dois períodos com deltas absolutos e relativos', () => {
    const t = acceptanceTransactions();
    const r = comparePeriods(
      t,
      { from: d('2026-09-01'), to: d('2026-09-30') },
      { from: d('2026-08-01'), to: d('2026-08-31') },
    );
    expect(r.a.depositedCents).toBe(51500);
    expect(r.b.depositedCents).toBe(31500);
    expect(r.deltas.depositedCents.absolute).toBe(20000);
    expect(r.deltas.depositedCents.ratio).toBeCloseTo(0.6349, 4);
    expect(r.a.netCents).toBe(-28450);
    expect(r.b.netCents).toBe(3500);
    expect(r.deltas.netCents.absolute).toBe(-31950);
    expect(r.deltas.netCents.ratio).toBeCloseTo(-31950 / 3500, 10);
    expect(r.deltas.depositCount.absolute).toBe(0);
    expect(r.deltas.withdrawalCount.ratio).toBe(0);
  });
  it('base a zero dá ratio nulo; período vazio', () => {
    const r = comparePeriods(
      [],
      { from: d('2026-02-01'), to: d('2026-02-28') },
      { from: d('2026-01-01'), to: d('2026-01-31') },
    );
    expect(r.deltas.netCents).toEqual({ absolute: 0, ratio: null });
    expect(r.a.depositCount).toBe(0);
  });
});

describe('samePeriodLastYear / previousMonthsPeriod', () => {
  it('recua 12 meses nas duas datas', () => {
    expect(samePeriodLastYear({ from: d('2025-11-01'), to: d('2026-10-01') })).toEqual({
      from: '2024-11-01',
      to: '2025-10-01',
    });
  });
  it('29 de fevereiro passa a 28 em anos não bissextos, e o inverso mantém o dia', () => {
    expect(samePeriodLastYear({ from: d('2024-02-29'), to: d('2024-03-31') })).toEqual({
      from: '2023-02-28',
      to: '2023-03-31',
    });
    // 2028 → 2027 (não bissexto) e 2025-02-28 → 2024-02-28 (sem salto para 29)
    expect(samePeriodLastYear({ from: d('2028-02-29'), to: d('2028-02-29') })).toEqual({
      from: '2027-02-28',
      to: '2027-02-28',
    });
    expect(samePeriodLastYear({ from: d('2025-02-28'), to: d('2025-02-28') })).toEqual({
      from: '2024-02-28',
      to: '2024-02-28',
    });
  });
  it('uma data de 2024-03-01 recua para 2023-03-01 (sem efeito do ano bissexto)', () => {
    expect(samePeriodLastYear({ from: d('2024-03-01'), to: d('2024-12-31') })).toEqual({
      from: '2023-03-01',
      to: '2023-12-31',
    });
  });
  it('previousMonthsPeriod dá o mesmo número de meses imediatamente antes', () => {
    expect(previousMonthsPeriod({ from: d('2025-11-01'), to: d('2026-10-01') })).toEqual({
      from: '2024-11-01',
      to: '2025-10-31',
    });
    expect(previousMonthsPeriod({ from: d('2026-03-01'), to: d('2026-03-15') })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    // fevereiro bissexto no fim do período anterior
    expect(previousMonthsPeriod({ from: d('2024-03-01'), to: d('2024-05-31') })).toEqual({
      from: '2023-12-01',
      to: '2024-02-29',
    });
  });
});

describe('fillMonths / monthlyAligned', () => {
  const pt = (month: string, net: number, cumulative: number): MonthlyPoint => ({
    month: m(month),
    depositedCents: net < 0 ? -net : 0,
    withdrawnCents: net > 0 ? net : 0,
    netCents: net,
    cumulativeCents: cumulative,
    depositCount: net < 0 ? 1 : 0,
    withdrawalCount: net > 0 ? 1 : 0,
  });

  it('fillMonths preenche buracos e extremos, mantendo o acumulado', () => {
    const out = fillMonths([pt('2025-02', -100, -100), pt('2025-04', 300, 200)], m('2025-01'), m('2025-05'));
    expect(out.map((p) => p.month)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05']);
    expect(out.map((p) => p.netCents)).toEqual([0, -100, 0, 300, 0]);
    expect(out.map((p) => p.cumulativeCents)).toEqual([0, -100, -100, 200, 200]);
  });

  it('alinha séries com o mesmo comprimento por posição, com meses diferentes', () => {
    const a = [pt('2025-11', -100, -100), pt('2025-12', 50, -50)];
    const b = [pt('2024-11', 200, 200), pt('2024-12', -300, -100)];
    const r = monthlyAligned(a, b);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ index: 0, monthA: '2025-11', monthB: '2024-11' });
    expect(r[0]?.a.netCents).toBe(-100);
    expect(r[0]?.b.netCents).toBe(200);
    expect(r[1]?.a.cumulativeCents).toBe(-50);
    expect(r[1]?.b.cumulativeCents).toBe(-100);
  });

  it('um lado com buracos: os meses em falta ficam a zeros dentro do lado', () => {
    const a = [pt('2025-01', -100, -100), pt('2025-04', 400, 300)];
    const b = [pt('2025-01', 10, 10), pt('2025-02', 10, 20), pt('2025-03', 10, 30), pt('2025-04', 10, 40)];
    const r = monthlyAligned(a, b);
    expect(r.map((x) => x.a.netCents)).toEqual([-100, 0, 0, 400]);
    expect(r.map((x) => x.a.cumulativeCents)).toEqual([-100, -100, -100, 300]);
    expect(r.map((x) => x.monthA)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04']);
    expect(r.map((x) => x.b.netCents)).toEqual([10, 10, 10, 10]);
  });

  it('comprimentos diferentes: o lado mais curto acaba a zeros com o acumulado mantido', () => {
    const a = [pt('2025-01', -100, -100)];
    const b = [pt('2025-01', 10, 10), pt('2025-02', 20, 30), pt('2025-03', 30, 60)];
    const r = monthlyAligned(a, b);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.a.netCents)).toEqual([-100, 0, 0]);
    expect(r.map((x) => x.a.cumulativeCents)).toEqual([-100, -100, -100]);
    expect(r.map((x) => x.monthA)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(r.map((x) => x.b.cumulativeCents)).toEqual([10, 30, 60]);
  });

  it('um lado completamente vazio: tudo a zeros e sem meses de calendário', () => {
    const b = [pt('2025-01', 10, 10), pt('2025-02', 20, 30)];
    const r = monthlyAligned([], b);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.monthA === null && x.a.netCents === 0 && x.a.cumulativeCents === 0)).toBe(true);
    expect(r.map((x) => x.monthB)).toEqual(['2025-01', '2025-02']);
    expect(monthlyAligned(b, [])).toHaveLength(2);
    expect(monthlyAligned([], [])).toEqual([]);
  });

  it('atravessa o ano e um fevereiro bissexto sem perder meses', () => {
    const a = [pt('2023-12', 100, 100), pt('2024-03', 100, 200)];
    const r = monthlyAligned(a, []);
    expect(r.map((x) => x.monthA)).toEqual(['2023-12', '2024-01', '2024-02', '2024-03']);
    expect(r.map((x) => x.a.netCents)).toEqual([100, 0, 0, 100]);
  });
});

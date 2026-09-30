import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { IsoDate, TxnType } from '../types';
import { diffTransactions, type DiffRow } from './diff';

const row = (date: string, type: TxnType, amountCents: number, tag = ''): DiffRow & { tag: string } => ({
  date: date as IsoDate,
  type,
  amountCents,
  tag,
});

describe('diffTransactions', () => {
  it('separa novas, duplicadas e em falta', () => {
    const a = row('2025-03-14', 'deposit', 2000, 'a');
    const b = row('2025-03-15', 'withdrawal', 500, 'b');
    const old = row('2025-03-13', 'deposit', 100, 'old');
    const stored = row('2025-03-14', 'deposit', 2000, 'stored');
    const r = diffTransactions([a, b], [stored, old]);
    expect(r.duplicates).toEqual([a]);
    expect(r.toAdd).toEqual([b]);
    expect(r.missingFromFile).toEqual([old]);
    expect(r.conflicts).toEqual([]);
  });

  it('preserva as instâncias recebidas', () => {
    const a = row('2025-03-14', 'deposit', 2000);
    const stored = row('2025-03-14', 'deposit', 2000);
    const r = diffTransactions([a], [stored]);
    expect(r.duplicates[0]).toBe(a);
  });

  it('trata linhas iguais como multiconjunto', () => {
    const inc = [1, 2, 3].map((n) => row('2025-03-14', 'deposit', 2000, `i${n}`));
    const exi = [1, 2].map((n) => row('2025-03-14', 'deposit', 2000, `e${n}`));
    const r = diffTransactions(inc, exi);
    expect(r.duplicates.map((x) => x.tag)).toEqual(['i1', 'i2']);
    expect(r.toAdd.map((x) => x.tag)).toEqual(['i3']);
    expect(r.missingFromFile).toEqual([]);

    const r2 = diffTransactions(exi, inc);
    expect(r2.duplicates).toHaveLength(2);
    expect(r2.missingFromFile.map((x) => x.tag)).toEqual(['i3']);
  });

  it('o mesmo valor em tipos diferentes não é duplicado', () => {
    const r = diffTransactions([row('2025-03-14', 'deposit', 2000)], [row('2025-03-14', 'withdrawal', 2000)]);
    expect(r.duplicates).toEqual([]);
    expect(r.toAdd).toHaveLength(1);
    expect(r.missingFromFile).toHaveLength(1);
    expect(r.conflicts).toEqual([]);
  });

  it('emparelha conflitos por data e tipo, pela ordem, e retira-os de toAdd e missingFromFile', () => {
    const i1 = row('2025-03-14', 'deposit', 2100, 'i1');
    const i2 = row('2025-03-14', 'deposit', 2200, 'i2');
    const i3 = row('2025-03-14', 'deposit', 2300, 'i3');
    const e1 = row('2025-03-14', 'deposit', 2000, 'e1');
    const e2 = row('2025-03-14', 'deposit', 2001, 'e2');
    const r = diffTransactions([i1, i2, i3], [e1, e2]);
    expect(r.conflicts).toEqual([
      { incoming: i1, existing: e1 },
      { incoming: i2, existing: e2 },
    ]);
    expect(r.toAdd).toEqual([i3]);
    expect(r.missingFromFile).toEqual([]);
  });

  it('um duplicado exato tem prioridade sobre um conflito', () => {
    const i1 = row('2025-03-14', 'deposit', 2000, 'i1');
    const i2 = row('2025-03-14', 'deposit', 999, 'i2');
    const e1 = row('2025-03-14', 'deposit', 2000, 'e1');
    const r = diffTransactions([i2, i1], [e1]);
    expect(r.duplicates).toEqual([i1]);
    expect(r.toAdd).toEqual([i2]);
    expect(r.conflicts).toEqual([]);
  });

  it('é determinístico', () => {
    const inc = [
      row('2025-03-14', 'deposit', 1),
      row('2025-03-14', 'deposit', 2),
      row('2025-03-15', 'withdrawal', 3),
    ];
    const exi = [row('2025-03-14', 'deposit', 9), row('2025-03-17', 'deposit', 4)];
    expect(diffTransactions(inc, exi)).toEqual(diffTransactions(inc, exi));
  });

  it('entradas vazias', () => {
    expect(diffTransactions([], [])).toEqual({
      toAdd: [],
      duplicates: [],
      missingFromFile: [],
      conflicts: [],
    });
  });

  it('propriedade: diff(x, x) é tudo duplicados', () => {
    const arbRow = fc.record({
      date: fc.constantFrom('2023-01-01', '2023-01-02', '2023-02-01').map((d) => d as IsoDate),
      type: fc.constantFrom<TxnType>('deposit', 'withdrawal'),
      amountCents: fc.integer({ min: 1, max: 5 }),
    });
    fc.assert(
      fc.property(fc.array(arbRow, { maxLength: 30 }), (xs) => {
        const r = diffTransactions(xs, xs);
        expect(r.duplicates).toEqual(xs);
        expect(r.toAdd).toEqual([]);
        expect(r.missingFromFile).toEqual([]);
        expect(r.conflicts).toEqual([]);
      }),
    );
  });
});

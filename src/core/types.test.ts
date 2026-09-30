import { describe, expect, it } from 'vitest';
import { err, netEffect, ok } from './types';

describe('netEffect', () => {
  it('levantamentos somam e depósitos subtraem', () => {
    expect(netEffect({ type: 'withdrawal', amountCents: 12000 })).toBe(12000);
    expect(netEffect({ type: 'deposit', amountCents: 5000 })).toBe(-5000);
  });
});

describe('Result', () => {
  it('ok e err constroem as duas variantes', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('x')).toEqual({ ok: false, error: 'x' });
  });
});

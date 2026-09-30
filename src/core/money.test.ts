import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatCents } from './format';
import { detectDecimalHint, parseAmount, sumCents } from './money';

const cents = (raw: string, hint?: 'comma' | 'dot') => {
  const r = parseAmount(raw, hint);
  if (!r.ok) throw new Error(`${raw}: ${r.error}`);
  return r.value;
};

describe('parseAmount', () => {
  it.each([
    ['20', 2000],
    ['20,00', 2000],
    ['20,5', 2050],
    ['20.5', 2050],
    ['0,05', 5],
    [',50', 50],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1 234,56', 123456],
    ['1 234,56', 123456],
    ['1.234.567', 123456700],
    ['€ 50', 5000],
    ['50€', 5000],
    ['50 EUR', 5000],
    ['+10', 1000],
    ['-5', -500],
    ['−5,25', -525],
  ])('%s → %i cêntimos', (raw, expected) => {
    expect(cents(raw)).toBe(expected);
  });

  it('desambigua um único separador com 3 dígitos pelo separador decimal do ficheiro', () => {
    expect(cents('1.234', 'comma')).toBe(123400);
    expect(parseAmount('1,234', 'comma')).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(parseAmount('1.234', 'dot')).toEqual({ ok: false, error: 'too_many_decimals' });
    expect(cents('1,234', 'dot')).toBe(123400);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'invalid'],
    ['12a', 'invalid'],
    ['1.2.3', 'invalid'],
    ['12.34.5', 'invalid'],
    ['1,23,4.5', 'invalid'],
    ['.', 'invalid'],
    ['--5', 'invalid'],
    ['1,234.5.6', 'invalid'],
    ['1,9999', 'too_many_decimals'],
    ['1.234,567', 'too_many_decimals'],
  ] as const)('%j → erro %s', (raw, error) => {
    expect(parseAmount(raw)).toEqual({ ok: false, error });
  });

  it('rejeita valores fora do intervalo seguro', () => {
    expect(parseAmount('999999999999999999')).toEqual({ ok: false, error: 'out_of_range' });
  });

  it('ida e volta: formatCents → parseAmount devolve o mesmo valor', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e11, max: 1e11 }), (value) => {
        expect(cents(formatCents(value))).toBe(value);
        expect(cents(formatCents(value, { currency: false }))).toBe(value);
      }),
    );
  });

  it('formato inglês com milhares: ida e volta', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e10 }), (value) => {
        const en = (value / 100).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        expect(cents(en, 'dot')).toBe(value);
      }),
    );
  });
});

describe('detectDecimalHint', () => {
  it('reconhece vírgula decimal (formato português)', () => {
    expect(detectDecimalHint(['20,00', '15', '1.234,56'])).toBe('comma');
  });
  it('reconhece ponto decimal', () => {
    expect(detectDecimalHint(['20.00', '15.5', '3'])).toBe('dot');
  });
  it('por omissão assume vírgula', () => {
    expect(detectDecimalHint(['20', '15'])).toBe('comma');
  });
});

describe('sumCents', () => {
  it('soma sem erros de vírgula flutuante', () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents([])).toBe(0);
  });
});

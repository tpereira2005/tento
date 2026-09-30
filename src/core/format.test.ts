import { describe, expect, it } from 'vitest';
import { formatCents, formatPercent } from './format';

describe('formatCents', () => {
  it('formata com separador de milhares, vírgula decimal e euro', () => {
    expect(formatCents(428000)).toBe('4 280,00 €');
  });

  it('usa o sinal de menos tipográfico', () => {
    expect(formatCents(-66450)).toBe('−664,50 €');
  });

  it('mostra "+" só quando pedido', () => {
    expect(formatCents(31000, { signed: true })).toBe('+310,00 €');
    expect(formatCents(31000)).toBe('310,00 €');
    expect(formatCents(0, { signed: true })).toBe('0,00 €');
  });

  it('permite omitir decimais e moeda', () => {
    expect(formatCents(-28450, { decimals: 0, currency: false })).toBe('−285');
    expect(formatCents(5, { currency: false })).toBe('0,05');
  });

  it('rejeita valores que não são cêntimos inteiros', () => {
    expect(() => formatCents(1.5)).toThrow(RangeError);
  });
});

describe('formatPercent', () => {
  it('usa uma casa decimal só quando necessário', () => {
    expect(formatPercent(0.8447)).toBe('84,5 %');
    expect(formatPercent(0.09)).toBe('9 %');
  });
});

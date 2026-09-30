/**
 * Formatação de valores monetários em pt-PT.
 * Os valores circulam sempre em cêntimos inteiros; só a apresentação usa decimais.
 */

const MINUS = '−'; // sinal de menos tipográfico
const NBSP = ' ';
const NNBSP = ' '; // separador de milhares

export interface FormatMoneyOptions {
  /** Mostra "+" nos valores positivos. */
  signed?: boolean;
  /** Acrescenta o símbolo do euro. */
  currency?: boolean;
  /** Casas decimais (0 ou 2). */
  decimals?: 0 | 2;
}

export function formatCents(cents: number, options: FormatMoneyOptions = {}): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Valor em cêntimos inválido: ${String(cents)}`);
  const { signed = false, currency = true, decimals = 2 } = options;
  const abs = Math.abs(cents);
  const units = decimals === 2 ? Math.floor(abs / 100) : Math.round(abs / 100);
  const intPart = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const decPart = decimals === 2 ? `,${String(abs % 100).padStart(2, '0')}` : '';
  const sign = cents < 0 ? MINUS : signed && cents > 0 ? '+' : '';
  return `${sign}${intPart}${decPart}${currency ? `${NBSP}€` : ''}`;
}

/** Percentagem com uma casa decimal quando necessário ("84,5 %", "9 %"). */
export function formatPercent(ratio: number): string {
  const value = Math.round(ratio * 1000) / 10;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
  return `${text}${NBSP}%`;
}

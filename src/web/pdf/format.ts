import { formatCents, formatPercent, type FormatMoneyOptions } from '../../core/format';
import type { ReportLabels } from './types';

const NNBSP = ' ';
const NBSP = ' ';

/**
 * O DM Mono não tem o espaço fino inseparável (U+202F) dos milhares: no PDF seria desenhado como "/".
 * Todo o texto numérico do PDF passa por aqui e troca-o pelo espaço inseparável normal (U+00A0).
 */
export function pdfSafe(text: string): string {
  return text.replaceAll(NNBSP, NBSP);
}

export function pdfMoney(cents: number, options: FormatMoneyOptions = {}): string {
  return pdfSafe(formatCents(cents, options));
}

export function pdfPercent(ratio: number): string {
  return pdfSafe(formatPercent(ratio));
}

/** "AAAA-MM-DD" → "dd/mm/aaaa". */
export function pdfDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** "AAAA-MM" → "out 2025". */
export function monthLong(month: string, labels: ReportLabels): string {
  const name = labels.monthsShort[Number(month.slice(5, 7)) - 1] ?? month.slice(5, 7);
  return `${name} ${month.slice(0, 4)}`;
}

/** "AAAA-MM" → "out". */
export function monthShort(month: string, labels: ReportLabels): string {
  return labels.monthsShort[Number(month.slice(5, 7)) - 1] ?? month.slice(5, 7);
}

/** Substitui `{chave}` por valores. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Marca do eixo: com sinal, sem decimais e sem €. */
export function tickLabel(cents: number): string {
  return cents === 0 ? '0' : pdfMoney(cents, { signed: true, currency: false, decimals: 0 });
}

/** Rótulo direto numa barra: sem decimais quando o valor é redondo. */
export function barLabel(cents: number): string {
  return pdfMoney(cents, { signed: true, currency: false, decimals: cents % 100 === 0 ? 0 : 2 });
}

/** Cor semântica de um valor (o sinal e o triângulo continuam a ser desenhados à parte). */
export function signOf(cents: number): 'positive' | 'negative' | 'zero' {
  return cents > 0 ? 'positive' : cents < 0 ? 'negative' : 'zero';
}

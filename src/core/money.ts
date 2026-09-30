import { err, ok, type Cents, type Result } from './types';

export type AmountError = 'empty' | 'invalid' | 'too_many_decimals' | 'out_of_range';

/**
 * Qual é o separador decimal do ficheiro. Só é usado para desambiguar valores como `1.234` ou `1,234`
 * (um único separador seguido de exatamente 3 dígitos).
 */
export type DecimalHint = 'comma' | 'dot';

const MAX_CENTS = Number.MAX_SAFE_INTEGER;

/**
 * Converte texto num montante em cêntimos, aceitando os formatos que aparecem em CSVs portugueses e
 * ingleses: `20`, `20,00`, `20.5`, `1.234,56`, `1,234.56`, `1 234,56`, `€ 50`, `50€`, `-5`, `\u22125`.
 *
 * Regras:
 * - com `.` e `,` presentes, o último que aparece é o separador decimal;
 * - com um só tipo de separador repetido (`1.234.567`), são milhares;
 * - com um único separador seguido de 1–2 dígitos, é decimal;
 * - com um único separador seguido de 3 dígitos, decide `hint` (vírgula decimal ⇒ `1.234` são milhares).
 */
export function parseAmount(raw: string, hint: DecimalHint = 'comma'): Result<Cents, AmountError> {
  let s = raw
    .replace(/[\u00A0\u202F\s]/g, '')
    .replace(/€|EUR/gi, '')
    .replace(/\u2212/g, '-');
  if (s === '') return err('empty');

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return err('invalid');

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart: string;
  let decPart = '';

  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = lastDot > lastComma ? '.' : ',';
    const thouSep = decSep === '.' ? ',' : '.';
    const idx = s.lastIndexOf(decSep);
    intPart = s.slice(0, idx);
    decPart = s.slice(idx + 1);
    if (intPart.includes(decSep) || !validGrouping(intPart, thouSep)) return err('invalid');
    intPart = intPart.split(thouSep).join('');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    if (parts.length > 2) {
      if (!validGrouping(s, sep)) return err('invalid');
      intPart = parts.join('');
    } else {
      const [a = '', b = ''] = parts;
      const isThousands =
        b.length === 3 &&
        a.length > 0 &&
        ((sep === '.' && hint === 'comma') || (sep === ',' && hint === 'dot'));
      if (isThousands) {
        intPart = a + b;
      } else {
        intPart = a === '' ? '0' : a;
        decPart = b;
      }
    }
  } else {
    intPart = s;
  }

  if (intPart === '' || !/^\d+$/.test(intPart) || (decPart !== '' && !/^\d+$/.test(decPart)))
    return err('invalid');
  if (decPart.length > 2) return err('too_many_decimals');

  const units = Number(intPart);
  const cents = units * 100 + Number(decPart.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return err('out_of_range');
  return ok(negative ? -cents : cents);
}

/** `1.234.567` é um agrupamento de milhares válido; `12.34.5` não. */
function validGrouping(s: string, sep: string): boolean {
  if (!s.includes(sep)) return true;
  const groups = s.split(sep);
  const [first = '', ...rest] = groups;
  return first.length >= 1 && first.length <= 3 && rest.every((g) => g.length === 3);
}

/** Deteta o separador decimal mais provável de um conjunto de valores (por exemplo, uma coluna de CSV). */
export function detectDecimalHint(values: readonly string[]): DecimalHint {
  let comma = 0;
  let dot = 0;
  for (const v of values) {
    if (/,\d{1,2}$/.test(v.trim().replace(/€|EUR/gi, '').trim())) comma++;
    else if (/\.\d{1,2}$/.test(v.trim().replace(/€|EUR/gi, '').trim())) dot++;
  }
  return dot > comma ? 'dot' : 'comma';
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

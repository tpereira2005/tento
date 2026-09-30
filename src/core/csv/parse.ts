import Papa from 'papaparse';
import { parseDate } from '../dates';
import { detectDecimalHint, parseAmount, type DecimalHint } from '../money';
import type { Cents, IsoDate, TxnType } from '../types';
import { mapHeaders, normalizeType, type ColumnField } from './headers';

export type Delimiter = ';' | ',' | '\t';

export interface ParsedRow {
  /** Linha (base 1) no ficheiro. */
  line: number;
  date: IsoDate;
  type: TxnType;
  /** Sempre > 0. */
  amountCents: Cents;
  /** Ordem (base 0) entre as linhas da mesma data, pela ordem do ficheiro. */
  seq: number;
}

export type RowIssueCode =
  | 'invalid_date'
  | 'invalid_type'
  | 'invalid_amount'
  | 'too_many_decimals'
  | 'negative_amount'
  | 'zero_amount'
  | 'missing_fields';

export interface RowIssue {
  line: number;
  field: ColumnField | 'row';
  code: RowIssueCode;
  raw: string;
}

export interface CsvMeta {
  delimiter: Delimiter;
  decimalHint: DecimalHint;
  hadBom: boolean;
  /** Linhas de dados não vazias (depois do cabeçalho). */
  totalDataLines: number;
  /** Linha (base 1) do cabeçalho. */
  headerLine: number;
}

export type CsvFatalError =
  | { code: 'empty' }
  | { code: 'no_header' }
  | { code: 'too_many_rows' }
  | { code: 'missing_columns'; missing: ColumnField[] };

export type ParseCsvResult =
  | { ok: true; value: { rows: ParsedRow[]; issues: RowIssue[]; meta: CsvMeta } }
  | { ok: false; error: CsvFatalError };

export interface ParseCsvOptions {
  maxRows?: number;
}

const DEFAULT_MAX_ROWS = 50_000;
const CANDIDATES: readonly Delimiter[] = [';', '\t', ','];
const SAMPLE_LINES = 10;

/** Conta um delimitador fora de aspas. */
function countOutsideQuotes(line: string, ch: string): number {
  let inQuotes = false;
  let n = 0;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === ch) n++;
  }
  return n;
}

/**
 * Escolhe o delimitador pela consistência das primeiras linhas. O cabeçalho precisa de pelo menos 3 colunas
 * (2 delimitadores); `;` ganha sempre que está no cabeçalho (vírgulas podem ser decimais).
 */
export function detectDelimiter(lines: readonly string[]): Delimiter {
  const sample = lines.slice(0, SAMPLE_LINES);
  const header = sample[0] ?? '';
  let best: Delimiter = ';';
  let bestScore = 0;
  for (const d of CANDIDATES) {
    const h = countOutsideQuotes(header, d);
    if (h < 2) continue;
    if (d === ';') return d;
    const score = sample.filter((l) => countOutsideQuotes(l, d) === h).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

const isBlank = (cells: readonly string[]) => cells.every((c) => c.trim() === '');

const AMOUNT_CODES = {
  empty: 'invalid_amount',
  invalid: 'invalid_amount',
  out_of_range: 'invalid_amount',
  too_many_decimals: 'too_many_decimals',
} as const;

/**
 * Lê um CSV de movimentos (depósitos e levantamentos). Linhas com problemas ficam de fora de `rows` e
 * todos os seus problemas são comunicados em `issues`.
 */
export function parseTransactionsCsv(text: string, options: ParseCsvOptions = {}): ParseCsvResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const hadBom = text.startsWith('﻿');
  const body = hadBom ? text.slice(1) : text;

  const nonBlankLines = body.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  if (nonBlankLines.length === 0) return { ok: false, error: { code: 'empty' } };

  const delimiter = detectDelimiter(nonBlankLines);
  const records = Papa.parse<string[]>(body, { delimiter, skipEmptyLines: false }).data;

  const headerIndex = records.findIndex((r) => !isBlank(r));
  const headerCells = records.slice(headerIndex, headerIndex + 1).flat(); // há sempre uma linha não vazia
  const mapped = mapHeaders(headerCells);
  if (!mapped.ok) {
    const { missing } = mapped.error;
    return {
      ok: false,
      error: missing.length === 3 ? { code: 'no_header' } : { code: 'missing_columns', missing },
    };
  }
  const cols = mapped.value;

  const dataRecords: { line: number; cells: string[] }[] = [];
  records.forEach((cells, i) => {
    if (i > headerIndex && !isBlank(cells)) dataRecords.push({ line: i + 1, cells });
  });
  if (dataRecords.length > maxRows) return { ok: false, error: { code: 'too_many_rows' } };

  const decimalHint = detectDecimalHint(dataRecords.map((r) => r.cells[cols.amount] ?? ''));
  const maxCol = Math.max(cols.date, cols.type, cols.amount);

  const rows: ParsedRow[] = [];
  const issues: RowIssue[] = [];
  const seqByDate = new Map<string, number>();

  for (const { line, cells } of dataRecords) {
    if (cells.length <= maxCol) {
      issues.push({ line, field: 'row', code: 'missing_fields', raw: cells.join(delimiter) });
      continue;
    }
    // `cells.length > maxCol` garante que as três posições existem
    const rawDate = String(cells[cols.date]);
    const rawType = String(cells[cols.type]);
    const rawAmount = String(cells[cols.amount]);
    const before = issues.length;

    const date = parseDate(rawDate);
    if (!date.ok) issues.push({ line, field: 'date', code: 'invalid_date', raw: rawDate });

    const type = normalizeType(rawType);
    if (type === null) issues.push({ line, field: 'type', code: 'invalid_type', raw: rawType });

    const amount = parseAmount(rawAmount, decimalHint);
    if (!amount.ok) {
      issues.push({ line, field: 'amount', code: AMOUNT_CODES[amount.error], raw: rawAmount });
    } else if (amount.value < 0) {
      issues.push({ line, field: 'amount', code: 'negative_amount', raw: rawAmount });
    } else if (amount.value === 0) {
      issues.push({ line, field: 'amount', code: 'zero_amount', raw: rawAmount });
    }

    if (issues.length > before || !date.ok || type === null || !amount.ok) continue;
    const seq = seqByDate.get(date.value) ?? 0;
    seqByDate.set(date.value, seq + 1);
    rows.push({ line, date: date.value, type, amountCents: amount.value, seq });
  }

  return {
    ok: true,
    value: {
      rows,
      issues,
      meta: {
        delimiter,
        decimalHint,
        hadBom,
        totalDataLines: dataRecords.length,
        headerLine: headerIndex + 1,
      },
    },
  };
}

import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { IsoDate, TxnType } from '../types';
import { detectDelimiter, parseTransactionsCsv, type ParsedRow } from './parse';

const fixture = (name: string) =>
  readFileSync(new URL(`../../../tests/fixtures/csv/${name}`, import.meta.url), 'utf8');

function parseOk(text: string, options?: { maxRows?: number }) {
  const r = parseTransactionsCsv(text, options);
  if (!r.ok) throw new Error(`erro fatal: ${r.error.code}`);
  return r.value;
}

const brief = (rows: ParsedRow[]) => rows.map((r) => [r.date, r.type, r.amountCents, r.seq]);

describe('parseTransactionsCsv: formatos', () => {
  it('lê o formato canónico com BOM e CRLF (fixture)', () => {
    const text = fixture('canonico.csv');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('\r\n');
    const v = parseOk(text);
    expect(v.meta).toEqual({
      delimiter: ';',
      decimalHint: 'comma',
      hadBom: true,
      totalDataLines: 4,
      headerLine: 1,
    });
    expect(v.issues).toEqual([]);
    expect(brief(v.rows)).toEqual([
      ['2025-03-14', 'deposit', 2000, 0],
      ['2025-03-14', 'withdrawal', 2000, 1],
      ['2025-03-15', 'deposit', 123450, 0],
      ['2025-03-15', 'deposit', 1500, 1],
    ]);
    expect(v.rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
  });

  it('lê cabeçalhos portugueses, datas dd/mm/aaaa, vírgula como delimitador e decimais entre aspas', () => {
    const v = parseOk(fixture('portugues-virgulas.csv'));
    expect(v.meta.delimiter).toBe(',');
    expect(v.meta.hadBom).toBe(false);
    expect(v.issues).toEqual([]);
    expect(brief(v.rows)).toEqual([
      ['2025-03-14', 'deposit', 2050, 0],
      ['2025-03-15', 'withdrawal', 123400, 0],
    ]);
  });

  it('lê ficheiros com tabulações, decimais em inglês e milhares', () => {
    const v = parseOk(fixture('tabs.csv'));
    expect(v.meta.delimiter).toBe('\t');
    expect(v.meta.decimalHint).toBe('dot');
    expect(brief(v.rows)).toEqual([
      ['2025-03-14', 'deposit', 123450, 0],
      ['2025-03-17', 'withdrawal', 9990, 0],
    ]);
  });

  it('usa a dica decimal da coluna toda para valores ambíguos', () => {
    const comma = parseOk('Date;Type;Amount\n2023-01-01;deposit;1.234\n2023-01-02;deposit;5,50\n');
    expect(comma.rows.map((r) => r.amountCents)).toEqual([123400, 550]);
    const dot = parseOk('Date;Type;Amount\n2023-01-01;deposit;1,234\n2023-01-02;deposit;5.50\n');
    expect(dot.meta.decimalHint).toBe('dot');
    expect(dot.rows.map((r) => r.amountCents)).toEqual([123400, 550]);
  });

  it('aceita LF, CR isolado, linhas em branco, colunas extra e símbolo €', () => {
    const text = [
      '',
      '  ',
      'Nota;Data;Tipo;Valor;Outra',
      'x;2023-03-01;Deposit;€ 10;y',
      '',
      ';;;;',
      'z;2023-03-02;Levantamento;5,5;',
      '',
    ].join('\n');
    const v = parseOk(text);
    expect(v.meta.headerLine).toBe(3);
    expect(v.meta.totalDataLines).toBe(2);
    expect(v.issues).toEqual([]);
    expect(v.rows.map((r) => [r.line, r.amountCents])).toEqual([
      [4, 1000],
      [7, 550],
    ]);
    const cr = parseOk('Date;Type;Amount\r2023-01-01;deposit;1\r2023-01-02;deposit;2');
    expect(cr.rows).toHaveLength(2);
  });

  it('aceita cabeçalho só, sem linhas de dados', () => {
    const v = parseOk('Date;Tipe;Vaule');
    expect(v.rows).toEqual([]);
    expect(v.issues).toEqual([]);
    expect(v.meta.totalDataLines).toBe(0);
  });

  it('aceita campos entre aspas com o delimitador dentro', () => {
    const v = parseOk('"Date";"Type";"Amount"\n"2023-01-01";"deposit";"1;5"\n');
    expect(v.issues).toEqual([{ line: 2, field: 'amount', code: 'invalid_amount', raw: '1;5' }]);
  });
});

describe('parseTransactionsCsv: seq', () => {
  it('numera por data pela ordem do ficheiro, ignorando linhas inválidas', () => {
    const v = parseOk(
      [
        'Date;Type;Amount',
        '2023-01-02;deposit;1',
        '2023-01-01;deposit;2',
        '2023-01-02;bogus;3',
        '2023-01-02;withdrawal;4',
        '2023-01-01;deposit;2',
      ].join('\n'),
    );
    expect(v.rows.map((r) => [r.line, r.date, r.seq])).toEqual([
      [2, '2023-01-02', 0],
      [3, '2023-01-01', 0],
      [5, '2023-01-02', 1],
      [6, '2023-01-01', 1],
    ]);
  });
});

describe('parseTransactionsCsv: problemas por linha', () => {
  it('reporta todos os problemas de uma linha e exclui-a', () => {
    const v = parseOk('Date;Type;Amount\n31/02/2023;bonus;abc\n2023-01-01;deposit;10\n');
    expect(v.rows).toHaveLength(1);
    expect(v.issues).toEqual([
      { line: 2, field: 'date', code: 'invalid_date', raw: '31/02/2023' },
      { line: 2, field: 'type', code: 'invalid_type', raw: 'bonus' },
      { line: 2, field: 'amount', code: 'invalid_amount', raw: 'abc' },
    ]);
  });

  it('distingue negativos, zeros, demasiadas casas decimais e valores vazios', () => {
    const v = parseOk(
      [
        'Date;Type;Amount',
        '2023-01-01;deposit;-5',
        '2023-01-01;deposit;0',
        '2023-01-01;deposit;0,00',
        '2023-01-01;deposit;1,234567',
        '2023-01-01;deposit;',
        '2023-01-01;deposit;99999999999999999999',
        'foo;withdrawal;1',
      ].join('\n'),
    );
    expect(v.rows).toEqual([]);
    expect(v.issues.map((i) => [i.line, i.field, i.code])).toEqual([
      [2, 'amount', 'negative_amount'],
      [3, 'amount', 'zero_amount'],
      [4, 'amount', 'zero_amount'],
      [5, 'amount', 'too_many_decimals'],
      [6, 'amount', 'invalid_amount'],
      [7, 'amount', 'invalid_amount'],
      [8, 'date', 'invalid_date'],
    ]);
  });

  it('reporta linhas com campos a menos', () => {
    const v = parseOk('Date;Type;Amount\n2023-01-01;deposit\n2023-01-02\n2023-01-03;deposit;5\n');
    expect(v.issues).toEqual([
      { line: 2, field: 'row', code: 'missing_fields', raw: '2023-01-01;deposit' },
      { line: 3, field: 'row', code: 'missing_fields', raw: '2023-01-02' },
    ]);
    expect(v.rows).toHaveLength(1);
    expect(v.meta.totalDataLines).toBe(3);
  });
});

describe('parseTransactionsCsv: erros fatais', () => {
  it('ficheiro vazio', () => {
    for (const t of ['', '﻿', '  \r\n\r\n ']) {
      expect(parseTransactionsCsv(t)).toEqual({ ok: false, error: { code: 'empty' } });
    }
  });

  it('sem cabeçalho reconhecível', () => {
    expect(parseTransactionsCsv('2023-01-01;deposit;10\n')).toEqual({
      ok: false,
      error: { code: 'no_header' },
    });
  });

  it('colunas em falta', () => {
    expect(parseTransactionsCsv('Date;Foo;Bar\n2023-01-01;a;b')).toEqual({
      ok: false,
      error: { code: 'missing_columns', missing: ['type', 'amount'] },
    });
    expect(parseTransactionsCsv('Data;Tipo\n1;2')).toEqual({
      ok: false,
      error: { code: 'missing_columns', missing: ['amount'] },
    });
  });

  it('demasiadas linhas', () => {
    const text = 'Date;Type;Amount\n2023-01-01;deposit;1\n2023-01-02;deposit;1\n2023-01-03;deposit;1\n';
    expect(parseTransactionsCsv(text, { maxRows: 2 })).toEqual({
      ok: false,
      error: { code: 'too_many_rows' },
    });
    expect(parseTransactionsCsv(text, { maxRows: 3 }).ok).toBe(true);
  });
});

describe('detectDelimiter', () => {
  it('prefere ; quando está no cabeçalho', () => {
    expect(detectDelimiter(['a;b;c', '1,5;2,5;3'])).toBe(';');
  });
  it('escolhe tab ou vírgula pela consistência', () => {
    expect(detectDelimiter(['a\tb\tc', '1\t2\t3'])).toBe('\t');
    expect(detectDelimiter(['a,b,c', '1,2,3', '4,5'])).toBe(',');
    expect(detectDelimiter(['a\tb\tc,d,e', '1\t2\t3', '4,5,6'])).toBe('\t');
    expect(detectDelimiter(['a\tb\tc,d,e', '1,2,3', '4,5,6'])).toBe(',');
  });
  it('ignora delimitadores dentro de aspas e cai em ; por omissão', () => {
    expect(detectDelimiter(['"a,b,c"', '1'])).toBe(';');
    expect(detectDelimiter([])).toBe(';');
  });
});

describe('parseTransactionsCsv: propriedade', () => {
  const arbRow = fc.record({
    year: fc.integer({ min: 2000, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    type: fc.constantFrom<TxnType>('deposit', 'withdrawal'),
    cents: fc.integer({ min: 1, max: 100_000_000 }),
  });

  it('parse(serialise(rows)) devolve as mesmas linhas', () => {
    fc.assert(
      fc.property(
        fc.array(arbRow, { maxLength: 40 }),
        fc.boolean(),
        fc.constantFrom('\r\n', '\n'),
        (generated, bom, eol) => {
          const p2 = (n: number) => String(n).padStart(2, '0');
          const lines = generated.map((g) => ({
            date: `${g.year}-${p2(g.month)}-${p2(g.day)}`,
            type: g.type,
            cents: g.cents,
          }));
          const body = lines.map((l) => {
            const amount = `${Math.floor(l.cents / 100)},${p2(l.cents % 100)}`;
            return `${l.date};${l.type === 'deposit' ? 'Deposit' : 'Withdrawal'};${amount}`;
          });
          const text = (bom ? '﻿' : '') + ['Date;Tipe;Vaule', ...body].join(eol) + eol;

          const seen = new Map<string, number>();
          const expected: ParsedRow[] = lines.map((l, i) => {
            const seq = seen.get(l.date) ?? 0;
            seen.set(l.date, seq + 1);
            return { line: i + 2, date: l.date as IsoDate, type: l.type, amountCents: l.cents, seq };
          });

          const v = parseOk(text);
          expect(v.issues).toEqual([]);
          expect(v.rows).toEqual(expected);
          expect(v.meta.hadBom).toBe(bom);
        },
      ),
    );
  });
});

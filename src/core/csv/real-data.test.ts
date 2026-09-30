/**
 * Validação com os CSVs reais do dono, lidos de uma pasta FORA do repositório.
 * Só corre com `TENTO_REAL_CSV_DIR` definida; no CI e sem a variável é ignorado.
 * Não afirma números concretos (os dados reais nunca entram no repositório): compara o parser com um
 * cálculo ingénuo e independente feito aqui, linha a linha.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarize } from '../stats';
import type { IsoDate, Transaction } from '../types';
import { parseTransactionsCsv } from './parse';

const dir = process.env.TENTO_REAL_CSV_DIR;
const files = dir ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')) : [];

/** Soma independente: ignora o cabeçalho, divide por ';' e converte "20,00" → 2000 sem usar o parser. */
function naiveTotals(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim() !== '');
  let deposited = 0;
  let withdrawn = 0;
  for (const line of lines) {
    const [, type = '', value = ''] = line.split(';');
    const [int = '0', dec = ''] = value.trim().split(',');
    const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
    if (type.trim().toLowerCase() === 'deposit') deposited += cents;
    else withdrawn += cents;
  }
  return { lines: lines.length, deposited, withdrawn };
}

describe.skipIf(!dir)('CSVs reais (TENTO_REAL_CSV_DIR)', () => {
  it('a pasta tem pelo menos um CSV', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file}: importa sem erros e os totais coincidem com o cálculo independente`, () => {
      const text = readFileSync(join(dir ?? '', file), 'utf8');
      const parsed = parseTransactionsCsv(text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const { rows, issues } = parsed.value;
      expect(issues).toEqual([]);

      const naive = naiveTotals(text);
      expect(rows).toHaveLength(naive.lines);

      const txns: Transaction[] = rows.map((r, i) => ({
        id: String(i),
        walletId: 'w',
        date: r.date,
        type: r.type,
        amountCents: r.amountCents,
        seq: r.seq,
      }));
      const s = summarize(txns, { today: '2026-09-30' as IsoDate });
      expect(s.depositedCents).toBe(naive.deposited);
      expect(s.withdrawnCents).toBe(naive.withdrawn);
      expect(s.netCents).toBe(naive.withdrawn - naive.deposited);
    });
  }
});

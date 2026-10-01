import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { beforeAll, describe, expect, it } from 'vitest';
import { titleLines } from './CoverPage';
import { demoReportInput } from './fixture';
import { registerPdfFonts } from './fonts';
import { pdfMoney, pdfPercent, pdfSafe } from './format';
import { enReportLabels } from './labels';
import { ReportDocument } from './ReportDocument';
import { extractPdfPages, nodeFontSources } from './test-support';
import { FIRST_PAGE_ROWS, NEXT_PAGE_ROWS, paginateTransactions } from './TransactionsPages';

// Construídos por código: o ESLint rejeita espaços irregulares literais e os diffs ficam ilegíveis.
const NNBSP = String.fromCharCode(0x202f);
const NBSP = String.fromCharCode(0x00a0);
// O pdf.js normaliza o espaço inseparável para um espaço normal ao extrair o texto.
const SP = `[${NBSP} ]`;

async function render(input = demoReportInput()): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<ReportDocument input={input} />));
}

beforeAll(async () => {
  await registerPdfFonts(nodeFontSources());
});

describe('formatação para o PDF', () => {
  it('troca o espaço fino U+202F pelo espaço inseparável U+00A0', () => {
    expect(pdfSafe(`4${NNBSP}280,00`)).toBe(`4${NBSP}280,00`);
    const text = pdfMoney(428000);
    expect(text).toBe(`4${NBSP}280,00${NBSP}€`);
    expect(text).not.toContain(NNBSP);
    expect(pdfMoney(-66450, { signed: true })).toBe(`−664,50${NBSP}€`);
    expect(pdfMoney(-1234567)).not.toContain(NNBSP);
    expect(pdfPercent(0.845)).toBe(`84,5${NBSP}%`);
  });
});

describe('relatório PDF (série de aceitação)', () => {
  it('tem 4+ páginas, os valores certos e rodapés com a paginação', async () => {
    const data = await render();
    const out = process.env.TENTO_PDF_OUT;
    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, data);
    }
    const pages = await extractPdfPages(data);
    const all = pages.join('\n');
    const total = String(pages.length);

    expect(pages.length).toBeGreaterThanOrEqual(4);
    expect(all).toMatch(new RegExp(`−664,50${SP}€`));
    expect(all).toMatch(new RegExp(`4${SP}280,00${SP}€`));
    expect(all).toMatch(new RegExp(`3${SP}615,50${SP}€`));
    expect(all).toContain('5 de 12');
    expect(all).toContain('Todos os perfis');
    expect(all).toContain('Todas as casas');
    expect(all).toContain('3 contas');
    expect(all).toContain('Ana · Casa A');
    expect(all).toContain('Levantamento');
    expect(all).toContain('30/09/2026');
    // Um milhar mal desenhado (glifo em falta) apareceria como "4/280".
    expect(all).not.toMatch(/\d\/\d{3},\d{2}/);
    expect(pages[0]).toContain('página 1 de');
    expect(pages[0]).toContain(`página 1 de ${total}`);
    expect(pages[pages.length - 1]).toContain(`página ${total} de ${total}`);
    for (const page of pages) expect(page).toContain('Tento · dados de Todos os perfis');
    expect(pages[1]).toContain('Evolução');
    expect(pages[2]).toContain('Repartições e destaques');
    expect(pages[3]).toContain('Transações');
    // Uma linha de transação: data, conta, tipo e efeito com sinal.
    expect(pages[3]).toContain('28/09/2026');
    expect(pages[3]).toMatch(new RegExp(`[+−]\\d+,\\d{2}${SP}€`));
  });

  it('nenhum texto tem o espaço fino inseparável U+202F', async () => {
    const pages = await extractPdfPages(await render());
    expect(pages.join('')).not.toContain(NNBSP);
  });

  it('1000 transações compõem-se em menos de 3 s e o cabeçalho repete-se em cada página', async () => {
    const input = demoReportInput(1000 - 48);
    expect(input.transactions).toHaveLength(1000);
    // A melhor de duas medições (a primeira apanha o aquecimento do JIT e do disco), em milissegundos.
    const timed = async (source: ReturnType<typeof demoReportInput>) => {
      let best = Infinity;
      let data: Uint8Array = new Uint8Array();
      for (let run = 0; run < 2; run += 1) {
        const start = performance.now();
        data = await render(source);
        best = Math.min(best, performance.now() - start);
      }
      return { best, data };
    };
    const base = await timed(demoReportInput());
    const { best, data } = await timed(input);
    console.info(
      `1000 transações: ${String(Math.round(best))} ms (48 transações, 4 páginas: ${String(Math.round(base.best))} ms), ${String(data.length)} bytes`,
    );
    // Com a máquina livre o orçamento é de 3 s. Com outros testes a correr ao mesmo tempo o relógio
    // incha, por isso o limite escala com o tempo medido agora para o relatório pequeno (a composição
    // automática do react-pdf custava ~20 vezes o relatório pequeno; esta custa ~4).
    expect(best).toBeLessThan(Math.max(3000, base.best * 7));

    const pages = await extractPdfPages(data);
    expect(pages.length).toBeGreaterThan(20);
    const txnPages = pages.slice(3);
    for (const page of txnPages) {
      expect(page).toContain('DATA');
      expect(page).toContain('EFEITO');
    }
    const total = String(pages.length);
    expect(pages[pages.length - 1]).toContain(`página ${total} de ${total}`);
    // Nenhuma linha se perde: contam-se as datas dd/mm/aaaa (cada rodapé traz a data de geração).
    const dates = txnPages.join('\n').match(/\b\d{2}\/\d{2}\/20\d{2}\b/g) ?? [];
    expect(dates.length - txnPages.length).toBe(1000);
  }, 60_000);

  it('em inglês usa os textos dos rótulos recebidos', async () => {
    const pages = await extractPdfPages(await render({ ...demoReportInput(), labels: enReportLabels }));
    expect(pages[0]).toContain('page 1 of');
    expect(pages[0]).toContain('5 of 12');
  });

  it('um âmbito vazio não rebenta e mostra os estados vazios', async () => {
    const base = demoReportInput();
    const pages = await extractPdfPages(
      await render({
        ...base,
        summary: {
          ...base.summary,
          depositedCents: 0,
          withdrawnCents: 0,
          netCents: 0,
          positiveMonths: 0,
          months: 0,
          avgMonthlyNetCents: 0,
          bestMonth: null,
          worstMonth: null,
          withdrawnRatio: null,
        },
        monthly: [],
        breakdown: { profiles: [], bookmakers: [], accounts: [] },
        insights: [],
        transactions: [],
      }),
    );
    expect(pages.length).toBe(4);
    expect(pages[3]).toContain('Não há transações');
  });
});

describe('paginação das transações', () => {
  it('distribui todas as linhas, sem páginas vazias, e a primeira leva menos', () => {
    const rows = demoReportInput(952).transactions;
    const pages = paginateTransactions(rows);
    expect(pages.flat()).toEqual(rows);
    expect(pages.every((p) => p.length > 0)).toBe(true);
    expect((pages[0]?.length ?? 0) < (pages[1]?.length ?? 0)).toBe(true);
    expect(paginateTransactions([])).toEqual([]);
  });

  it('respeita a capacidade de cada página', () => {
    const rows = demoReportInput(952).transactions;
    const pages = paginateTransactions(rows);
    expect(pages[0]).toHaveLength(FIRST_PAGE_ROWS);
    expect(pages[1]).toHaveLength(NEXT_PAGE_ROWS);
  });
});

describe('titleLines', () => {
  it('parte o título em duas linhas', () => {
    expect(titleLines('Relatório · out 2025 – set 2026')).toEqual(['Out 2025 –', 'Set 2026']);
    expect(titleLines('Relatório · todo o período')).toEqual(['Todo o período']);
  });
});

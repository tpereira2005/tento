import { G, Line, Page, Path, Svg, Text, View } from '@react-pdf/renderer';
import { fill, pdfDate, pdfMoney } from './format';
import { PageFooter, PageHeading, TableHeader, type Column } from './parts';
import { CONTENT_WIDTH, FONT, PAGE, PDF_COLORS as C } from './theme';
import type { ReportInput, ReportLabels, ReportTransaction } from './types';

/*
 * Tabela de transações, composta à mão para ser rápida.
 *
 * A quebra automática do react-pdf é superlinear no número de nós (1000 linhas de 6 colunas levavam
 * ~10 s) e cada célula é um nó. Aqui cada linha tem altura fixa, as linhas são repartidas por páginas
 * (cada página repete o cabeçalho) e as colunas de valores curtos são um único texto com uma linha
 * por transação. Só a conta e a nota (que podem ser longas) são um texto por linha, de uma só linha
 * com reticências, para nunca desalinhar as colunas.
 */

export const ROW_HEIGHT = 15.5;
const HEADER_HEIGHT = 17;
const HEADING_HEIGHT = 64;
const SLACK = 6;
const FONT_SIZE = 7.8;
const TRIANGLE = 6.5;
const BLANK = String.fromCharCode(0x00a0);

const X = { date: 0, account: 57, type: 142, amount: 214, effect: 282, note: 360 } as const;
const W = {
  date: 57,
  account: 85,
  type: 72,
  amount: 68,
  effect: 68,
  note: CONTENT_WIDTH - X.note,
} as const;
const TYPE_TEXT_X = X.type + TRIANGLE + 4;

const BODY_HEIGHT = PAGE.height - PAGE.marginTop - PAGE.marginBottom - SLACK;

/** Quantas linhas cabem na primeira página (com o título) e nas seguintes. */
export const FIRST_PAGE_ROWS = Math.floor((BODY_HEIGHT - HEADING_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT);
export const NEXT_PAGE_ROWS = Math.floor((BODY_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT);

/** Reparte as linhas por páginas; a primeira tem menos espaço (título da secção). */
export function paginateTransactions(rows: readonly ReportTransaction[]): ReportTransaction[][] {
  const pages: ReportTransaction[][] = [];
  let start = 0;
  while (start < rows.length) {
    const size = pages.length === 0 ? FIRST_PAGE_ROWS : NEXT_PAGE_ROWS;
    pages.push(rows.slice(start, start + size));
    start += size;
  }
  return pages;
}

function buildColumns(labels: ReportLabels): Column[] {
  return [
    { key: 'date', label: labels.colDate, width: W.date },
    { key: 'account', label: labels.colAccount, width: W.account },
    { key: 'type', label: labels.colType, width: W.type },
    { key: 'amount', label: labels.colAmount, width: W.amount, align: 'right' },
    { key: 'effect', label: labels.colEffect, width: W.effect, align: 'right' },
    { key: 'note', label: labels.colNote, padLeft: 10 },
  ];
}

const effectOf = (txn: ReportTransaction) => (txn.type === 'withdrawal' ? txn.amountCents : -txn.amountCents);

function cellText(
  left: number,
  width: number,
  font: string,
  color: string,
  align: 'left' | 'right' = 'left',
) {
  return {
    position: 'absolute',
    top: 1.8,
    left,
    width,
    fontFamily: font,
    fontSize: FONT_SIZE,
    lineHeight: ROW_HEIGHT / FONT_SIZE,
    color,
    textAlign: align,
  } as const;
}

/** Gradeada de uma página: filetes por baixo de cada linha e o triângulo ▲/▼ de cada tipo. */
function TableGrid({ rows }: { rows: ReportTransaction[] }) {
  return (
    <Svg
      width={CONTENT_WIDTH}
      height={rows.length * ROW_HEIGHT}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {rows.map((txn, i) => {
        const y = (i + 1) * ROW_HEIGHT;
        const top = i * ROW_HEIGHT + (ROW_HEIGHT - TRIANGLE) / 2 - 0.6;
        const x = X.type;
        const d =
          txn.type === 'withdrawal'
            ? `M${String(x + TRIANGLE / 2)} ${String(top)} L${String(x + TRIANGLE)} ${String(top + TRIANGLE)} L${String(x)} ${String(top + TRIANGLE)} Z`
            : `M${String(x)} ${String(top)} L${String(x + TRIANGLE)} ${String(top)} L${String(x + TRIANGLE / 2)} ${String(top + TRIANGLE)} Z`;
        return (
          <G key={i}>
            <Line x1={0} x2={CONTENT_WIDTH} y1={y} y2={y} stroke={C.line} strokeWidth={0.4} />
            <Path d={d} fill={txn.type === 'withdrawal' ? C.pos : C.neg} />
          </G>
        );
      })}
    </Svg>
  );
}

function TableBody({ rows, labels }: { rows: ReportTransaction[]; labels: ReportLabels }) {
  const lines = (pick: (txn: ReportTransaction) => string) => rows.map(pick).join('\n');
  const effectLines = (positive: boolean) =>
    lines((txn) => {
      const effect = effectOf(txn);
      return effect > 0 === positive ? pdfMoney(effect, { signed: true }) : BLANK;
    });
  return (
    <View style={{ position: 'relative', height: rows.length * ROW_HEIGHT, width: CONTENT_WIDTH }}>
      <TableGrid rows={rows} />
      <Text style={cellText(X.date, W.date, FONT.mono, C.ink)}>{lines((t) => pdfDate(t.date))}</Text>
      <Text style={cellText(TYPE_TEXT_X, W.type - TRIANGLE - 4, FONT.sans, C.ink)}>
        {lines((t) => (t.type === 'withdrawal' ? labels.withdrawal : labels.deposit))}
      </Text>
      <Text style={cellText(X.amount, W.amount, FONT.mono, C.ink, 'right')}>
        {lines((t) => pdfMoney(t.amountCents))}
      </Text>
      <Text style={cellText(X.effect, W.effect, FONT.mono, C.pos, 'right')}>{effectLines(true)}</Text>
      <Text style={cellText(X.effect, W.effect, FONT.mono, C.negText, 'right')}>{effectLines(false)}</Text>
      {rows.map((txn, i) => (
        <View key={i} style={{ position: 'absolute', top: i * ROW_HEIGHT, left: 0, width: CONTENT_WIDTH }}>
          <Text
            style={{
              ...cellText(X.account, W.account - 6, FONT.sans, C.ink),
              textOverflow: 'ellipsis',
              maxLines: 1,
            }}
          >
            {txn.account}
          </Text>
          {txn.note === null ? null : (
            <Text
              style={{
                ...cellText(X.note + 10, W.note - 10, FONT.sans, C.ink2),
                fontSize: 7.4,
                textOverflow: 'ellipsis',
                maxLines: 1,
              }}
            >
              {txn.note}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

/** Páginas 4+ — todas as transações, com o cabeçalho da tabela repetido em cada página. */
export function TransactionsPages({ input }: { input: ReportInput }) {
  const { labels, transactions } = input;
  const columns = buildColumns(labels);
  const count = fill(transactions.length === 1 ? labels.transactionsCountOne : labels.transactionsCountMany, {
    n: transactions.length,
  });
  const pages = paginateTransactions(transactions);
  const style = {
    backgroundColor: C.surface,
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingHorizontal: PAGE.marginX,
    color: C.ink,
  } as const;

  if (pages.length === 0) {
    return (
      <Page size="A4" style={style}>
        <PageHeading eyebrow={count} title={labels.transactionsTitle} />
        <Text style={{ fontFamily: FONT.display, fontStyle: 'italic', fontSize: 11, color: C.ink2 }}>
          {labels.noTransactions}
        </Text>
        <PageFooter input={input} />
      </Page>
    );
  }

  return (
    <>
      {pages.map((rows, index) => (
        <Page key={index} size="A4" style={style}>
          {index === 0 ? <PageHeading eyebrow={count} title={labels.transactionsTitle} /> : null}
          <TableHeader columns={columns} />
          <TableBody rows={rows} labels={labels} />
          <PageFooter input={input} />
        </Page>
      ))}
    </>
  );
}

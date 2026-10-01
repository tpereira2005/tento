import { Page, Text, View } from '@react-pdf/renderer';
import { CumulativeChart, MonthlyBarsChart } from './charts';
import { monthLong, pdfMoney, signOf } from './format';
import {
  cellStyle,
  PageFooter,
  SIGN_COLOR,
  PageHeading,
  SectionTitle,
  TableHeader,
  type Column,
} from './parts';
import { CONTENT_WIDTH, FONT, PAGE, PDF_COLORS as C } from './theme';
import type { ReportInput } from './types';

const pageStyle = {
  backgroundColor: C.surface,
  paddingTop: PAGE.marginTop,
  paddingBottom: PAGE.marginBottom,
  paddingHorizontal: PAGE.marginX,
  color: C.ink,
} as const;

function Empty({ text }: { text: string }) {
  return (
    <Text style={{ fontFamily: FONT.display, fontStyle: 'italic', fontSize: 11, color: C.ink2 }}>{text}</Text>
  );
}

/** Página 2 — evolução: acumulado, resultado mensal e tabela mês a mês. */
export function EvolutionPage({ input }: { input: ReportInput }) {
  const { labels, monthly } = input;
  const columns: Column[] = [
    { key: 'month', label: labels.colMonth, width: 90 },
    { key: 'dep', label: labels.colDeposited, align: 'right' },
    { key: 'wd', label: labels.colWithdrawn, align: 'right' },
    { key: 'net', label: labels.colNet, align: 'right' },
    { key: 'cum', label: labels.colCumulative, align: 'right' },
  ];
  const [monthCol, depCol, wdCol, netCol, cumCol] = columns;

  return (
    <Page size="A4" style={pageStyle}>
      <PageHeading eyebrow={labels.reportLabel} title={labels.evolutionTitle} />

      <SectionTitle title={labels.cumulativeTitle} note={labels.cumulativeNote} />
      {monthly.length >= 2 ? (
        <CumulativeChart months={monthly} labels={labels} width={CONTENT_WIDTH} height={175} />
      ) : (
        <Empty text={labels.empty} />
      )}

      <View style={{ marginTop: 14 }}>
        <SectionTitle title={labels.monthlyTitle} note={labels.monthlyNote} />
        {monthly.length >= 1 ? (
          <MonthlyBarsChart months={monthly} labels={labels} width={CONTENT_WIDTH} height={105} />
        ) : (
          <Empty text={labels.empty} />
        )}
      </View>

      {monthly.length >= 1 && monthCol && depCol && wdCol && netCol && cumCol ? (
        <View style={{ marginTop: 14 }}>
          <SectionTitle title={labels.monthlyTableTitle} />
          <TableHeader columns={columns} fixed />
          {monthly.map((row) => (
            <View
              key={row.month}
              wrap={false}
              style={{
                flexDirection: 'row',
                paddingVertical: 3,
                borderBottomWidth: 0.5,
                borderBottomColor: C.line,
              }}
            >
              <Text style={{ ...cellStyle(monthCol), fontFamily: FONT.mono, fontSize: 8, color: C.ink }}>
                {monthLong(row.month, labels)}
              </Text>
              <Text style={{ ...cellStyle(depCol), fontFamily: FONT.mono, fontSize: 8, color: C.ink }}>
                {pdfMoney(row.depositedCents)}
              </Text>
              <Text style={{ ...cellStyle(wdCol), fontFamily: FONT.mono, fontSize: 8, color: C.ink }}>
                {pdfMoney(row.withdrawnCents)}
              </Text>
              <Text
                style={{
                  ...cellStyle(netCol),
                  fontFamily: FONT.mono,
                  fontSize: 8,
                  color: SIGN_COLOR[signOf(row.netCents)],
                }}
              >
                {pdfMoney(row.netCents, { signed: true })}
              </Text>
              <Text
                style={{
                  ...cellStyle(cumCol),
                  fontFamily: FONT.mono,
                  fontSize: 8,
                  fontWeight: 500,
                  color: SIGN_COLOR[signOf(row.cumulativeCents)],
                }}
              >
                {pdfMoney(row.cumulativeCents, { signed: true })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <PageFooter input={input} />
    </Page>
  );
}

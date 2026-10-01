import { Page, Text, View } from '@react-pdf/renderer';
import { pdfMoney, pdfPercent, signOf } from './format';
import {
  cellStyle,
  PageFooter,
  SIGN_COLOR,
  PageHeading,
  SectionTitle,
  TableHeader,
  type Column,
} from './parts';
import { FONT, PAGE, PDF_COLORS as C } from './theme';
import type { ReportInput, ReportLabels, ReportRow } from './types';

const BAR_WIDTH = 58;

function BreakdownTable({ rows, labels }: { rows: ReportRow[]; labels: ReportLabels }) {
  if (rows.length === 0) return null;
  const columns: Column[] = [
    { key: 'label', label: '' },
    { key: 'dep', label: labels.colDeposited, width: 80, align: 'right' },
    { key: 'wd', label: labels.colWithdrawn, width: 80, align: 'right' },
    { key: 'net', label: labels.colNet, width: 80, align: 'right' },
    { key: 'share', label: labels.colShare, width: 104, align: 'right' },
  ];
  const [labelCol, depCol, wdCol, netCol, shareCol] = columns;
  if (!labelCol || !depCol || !wdCol || !netCol || !shareCol) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      <TableHeader columns={columns} />
      {rows.map((row) => {
        const sign = signOf(row.netCents);
        return (
          <View
            key={row.label}
            wrap={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 4,
              borderBottomWidth: 0.5,
              borderBottomColor: C.line,
            }}
          >
            <Text style={{ ...cellStyle(labelCol), fontFamily: FONT.sans, fontSize: 9, color: C.ink }}>
              {row.label}
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
                fontWeight: 500,
                color: SIGN_COLOR[sign],
              }}
            >
              {pdfMoney(row.netCents, { signed: true })}
            </Text>
            <View
              style={{
                width: shareCol.width ?? 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <View style={{ width: BAR_WIDTH, height: 4, backgroundColor: C.line, marginRight: 6 }}>
                <View
                  style={{
                    width: BAR_WIDTH * Math.min(Math.max(row.share, 0), 1),
                    height: 4,
                    backgroundColor: sign === 'positive' ? C.pos : C.neg,
                  }}
                />
              </View>
              <Text
                style={{ fontFamily: FONT.mono, fontSize: 7.5, color: C.ink2, width: 34, textAlign: 'right' }}
              >
                {pdfPercent(row.share)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Página 3 — repartições por perfil, casa e conta, e os destaques numerados. */
export function BreakdownPage({ input }: { input: ReportInput }) {
  const { labels, breakdown, insights } = input;
  return (
    <Page
      size="A4"
      style={{
        backgroundColor: C.surface,
        paddingTop: PAGE.marginTop,
        paddingBottom: PAGE.marginBottom,
        paddingHorizontal: PAGE.marginX,
        color: C.ink,
      }}
    >
      <PageHeading eyebrow={labels.reportLabel} title={labels.breakdownTitle} />

      <SectionTitle title={labels.byProfile} />
      <BreakdownTable rows={breakdown.profiles} labels={labels} />
      <SectionTitle title={labels.byBookmaker} />
      <BreakdownTable rows={breakdown.bookmakers} labels={labels} />
      <SectionTitle title={labels.byAccount} note={labels.shareNote} />
      <BreakdownTable rows={breakdown.accounts} labels={labels} />

      <SectionTitle title={labels.insightsTitle} />
      {insights.length === 0 ? (
        <Text style={{ fontFamily: FONT.display, fontStyle: 'italic', fontSize: 11, color: C.ink2 }}>
          {labels.noInsights}
        </Text>
      ) : (
        insights.map((text, i) => (
          <View
            key={text}
            wrap={false}
            style={{
              flexDirection: 'row',
              paddingVertical: 6,
              borderBottomWidth: 0.5,
              borderBottomColor: C.line,
            }}
          >
            <Text
              style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 13, color: C.pos, width: 24 }}
            >
              {i + 1}
            </Text>
            <Text
              style={{
                fontFamily: FONT.sans,
                fontSize: 9.5,
                lineHeight: 1.45,
                color: C.ink,
                flexGrow: 1,
                flexBasis: 0,
              }}
            >
              {text}
            </Text>
          </View>
        ))
      )}

      <PageFooter input={input} />
    </Page>
  );
}

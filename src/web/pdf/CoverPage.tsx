import { Page, Text, View } from '@react-pdf/renderer';
import { CumulativeChart } from './charts';
import { fill, monthLong, pdfMoney, pdfPercent, signOf } from './format';
import { Eyebrow, Hairline, Mark, PageFooter, Triangle } from './parts';
import { CONTENT_WIDTH, FONT, PAGE, PDF_COLORS as C } from './theme';
import type { ReportInput } from './types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Relatório · out 2025 – set 2026" → ["Out 2025 –", "Set 2026"] (a segunda linha vai em itálico). */
export function titleLines(title: string): [string] | [string, string] {
  const dot = title.lastIndexOf('·');
  const core = (dot >= 0 ? title.slice(dot + 1) : title).trim();
  const dash = core.indexOf(' – ');
  if (dash < 0) return [capitalize(core)];
  return [capitalize(core.slice(0, dash + 2)), capitalize(core.slice(dash + 3))];
}

const TONE = {
  positive: { color: C.pos, tone: 'pos' as const },
  negative: { color: C.negText, tone: 'negText' as const },
  zero: { color: C.ink, tone: undefined },
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: CONTENT_WIDTH / 3 }}>
      <Text style={{ fontFamily: FONT.sans, fontSize: 7.5, color: C.ink2 }}>{label}</Text>
      <Text style={{ fontFamily: FONT.mono, fontSize: 12, color: C.ink, marginTop: 3 }}>{value}</Text>
    </View>
  );
}

function StatLine({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 0 }}>
      <Text style={{ fontFamily: FONT.sans, fontSize: 7, color: C.ink2 }}>{label}</Text>
      <Text style={{ fontFamily: FONT.mono, fontSize: 8.5, color, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

/** Página 1 — capa e resumo (segue a miniatura aprovada em docs/design/identidade.png). */
export function CoverPage({ input }: { input: ReportInput }) {
  const { scope, summary, labels, monthly } = input;
  const lines = titleLines(input.title);
  const tone = TONE[signOf(summary.netCents)];
  const accounts = fill(scope.accounts === 1 ? labels.accountOne : labels.accountMany, { n: scope.accounts });
  const scopeLine = [scope.profile, scope.bookmaker, accounts].join(' · ');
  const money = (cents: number) => pdfMoney(cents, { signed: true });
  const extreme = (m: { month: string; netCents: number } | null) =>
    m ? `${monthLong(m.month, labels)} · ${money(m.netCents)}` : '—';
  const extremeColor = (m: { netCents: number } | null) => (m ? TONE[signOf(m.netCents)].color : C.ink);

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Mark size={22} />
          <Text style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 20, marginLeft: 8 }}>
            Tento
          </Text>
        </View>
        <Eyebrow>{labels.reportLabel}</Eyebrow>
      </View>

      <View style={{ marginTop: 56 }}>
        <Text style={{ fontFamily: FONT.display, fontWeight: 300, fontSize: 44, lineHeight: 1.08 }}>
          {lines[0]}
        </Text>
        {lines[1] ? (
          <Text
            style={{
              fontFamily: FONT.display,
              fontWeight: 300,
              fontStyle: 'italic',
              fontSize: 44,
              lineHeight: 1.08,
            }}
          >
            {lines[1]}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONT.sans, fontSize: 9, color: C.ink2, marginTop: 12 }}>{scopeLine}</Text>
      </View>

      <View style={{ marginTop: 34 }}>
        <Hairline />
      </View>

      <View style={{ marginTop: 22 }}>
        <Eyebrow>{labels.netResult}</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          {tone.tone ? (
            <View style={{ marginRight: 10 }}>
              <Triangle direction={summary.netCents > 0 ? 'up' : 'down'} size={17} tone={tone.tone} />
            </View>
          ) : null}
          <Text style={{ fontFamily: FONT.display, fontWeight: 300, fontSize: 60, color: tone.color }}>
            {money(summary.netCents)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 24 }}>
        <MiniStat label={labels.deposited} value={pdfMoney(summary.depositedCents)} />
        <MiniStat label={labels.withdrawn} value={pdfMoney(summary.withdrawnCents)} />
        <MiniStat
          label={labels.positiveMonths}
          value={fill(labels.positiveMonthsValue, { n: summary.positiveMonths, total: summary.months })}
        />
      </View>

      <View style={{ marginTop: 22, marginBottom: 6 }}>
        <Hairline />
      </View>
      <View style={{ flexDirection: 'row', paddingTop: 8, gap: 10 }}>
        <StatLine
          label={labels.averageMonthly}
          value={money(summary.avgMonthlyNetCents)}
          color={TONE[signOf(summary.avgMonthlyNetCents)].color}
        />
        <StatLine
          label={labels.bestMonth}
          value={extreme(summary.bestMonth)}
          color={extremeColor(summary.bestMonth)}
        />
        <StatLine
          label={labels.worstMonth}
          value={extreme(summary.worstMonth)}
          color={extremeColor(summary.worstMonth)}
        />
        {summary.withdrawnRatio === null ? null : (
          <StatLine label={labels.withdrawnRatio} value={pdfPercent(summary.withdrawnRatio)} />
        )}
      </View>

      <View style={{ marginTop: 30 }}>
        <Eyebrow>{labels.cumulativeShort}</Eyebrow>
        <View style={{ marginTop: 6 }}>
          {monthly.length >= 2 ? (
            <CumulativeChart months={monthly} labels={labels} width={CONTENT_WIDTH} height={170} compact />
          ) : (
            <Text style={{ fontFamily: FONT.display, fontStyle: 'italic', fontSize: 11, color: C.ink2 }}>
              {labels.empty}
            </Text>
          )}
        </View>
      </View>

      <PageFooter input={input} />
    </Page>
  );
}

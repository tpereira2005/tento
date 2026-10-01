import { Path, Rect, Svg, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { MARK_RULE, MARK_TOKEN_PATH } from '../ui/Logo';
import { fill, pdfDate } from './format';
import { CONTENT_WIDTH, FONT, PAGE, PDF_COLORS as C } from './theme';
import type { ReportInput } from './types';

/** Símbolo do Tento, o mesmo desenho de src/web/ui/Logo.tsx. */
export function Mark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d={MARK_TOKEN_PATH} fillRule="evenodd" fill={C.pos} />
      <Rect {...MARK_RULE} rx={1} fill={C.ink} />
    </Svg>
  );
}

/** ▲/▼ desenhados como caminhos (as fontes do PDF não têm os glifos). Cobalto para cima, coral para baixo. */
export function Triangle({
  direction,
  size,
  tone,
}: {
  direction: 'up' | 'down';
  size: number;
  tone?: 'pos' | 'neg' | 'negText';
}) {
  const d = direction === 'up' ? 'M5 1 L9.5 9 L0.5 9 Z' : 'M0.5 1 L9.5 1 L5 9 Z';
  const color = tone ? C[tone] : direction === 'up' ? C.pos : C.neg;
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Path d={d} fill={color} />
    </Svg>
  );
}

/** Texto pequeno em maiúsculas espaçadas (etiquetas de secção). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONT.mono,
        fontSize: 6.5,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        color: C.ink2,
      }}
    >
      {children}
    </Text>
  );
}

export function Hairline({
  color = C.line,
  marginVertical = 0,
}: {
  color?: string;
  marginVertical?: number;
}) {
  return <View style={{ height: 0, borderTopWidth: 0.7, borderTopColor: color, marginVertical }} />;
}

/** Título de página: etiqueta pequena + título em Fraunces. */
export function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={{ fontFamily: FONT.display, fontWeight: 300, fontSize: 28, color: C.ink, marginTop: 4 }}>
        {title}
      </Text>
    </View>
  );
}

export function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ marginBottom: 6 }} minPresenceAhead={120}>
      <Text style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 14, color: C.ink }}>{title}</Text>
      {note ? (
        <Text style={{ fontFamily: FONT.sans, fontSize: 7.5, color: C.ink2, marginTop: 2 }}>{note}</Text>
      ) : null}
    </View>
  );
}

/** Rodapé de todas as páginas: "Tento · dados de … · Gerado a … · página X de N". */
export function PageFooter({ input }: { input: ReportInput }) {
  const { scope, labels, generatedOn } = input;
  const scopeText = [scope.profile, scope.bookmaker, scope.period].join(' · ');
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        left: PAGE.marginX,
        width: CONTENT_WIDTH,
        bottom: 28,
        borderTopWidth: 0.7,
        borderTopColor: C.line,
        paddingTop: 7,
      }}
    >
      <Text
        render={({ pageNumber, totalPages }) =>
          fill(labels.footer, {
            scope: scopeText,
            date: pdfDate(generatedOn),
            page: pageNumber,
            total: totalPages,
          })
        }
        style={{ fontFamily: FONT.mono, fontSize: 6.5, color: C.ink2 }}
      />
    </View>
  );
}

export const SIGN_COLOR = { positive: C.pos, negative: C.negText, zero: C.ink } as const;

export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right';
  padLeft?: number;
}

/** Cabeçalho de tabela com filete por baixo; `fixed` repete-o em cada página. */
export function TableHeader({ columns, fixed = false }: { columns: Column[]; fixed?: boolean }) {
  return (
    <View
      fixed={fixed}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 0.9,
        borderBottomColor: C.ink,
        paddingBottom: 4,
        paddingTop: 2,
        backgroundColor: C.surface,
      }}
    >
      {columns.map((col) => (
        <Text
          key={col.key}
          style={{
            fontFamily: FONT.mono,
            fontSize: 6.5,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            color: C.ink2,
            textAlign: col.align ?? 'left',
            paddingLeft: col.padLeft ?? 0,
            ...(col.width === undefined ? { flexGrow: 1, flexBasis: 0 } : { width: col.width }),
          }}
        >
          {col.label}
        </Text>
      ))}
    </View>
  );
}

export function cellStyle(col: Column) {
  return {
    textAlign: col.align ?? 'left',
    paddingLeft: col.padLeft ?? 0,
    ...(col.width === undefined ? { flexGrow: 1, flexBasis: 0 } : { width: col.width }),
  } as const;
}

import { useId, type ReactNode } from 'react';
import { delta, formatCents, type Summary } from '../../../core';
import { t } from '../../i18n';
import { Amount, Card, SectionHeader } from '../../ui';
import { fill, MINUS, signedPercent } from '../painel/derive';
import type { SideModel } from './derive';

interface Row {
  key: string;
  label: string;
  a: ReactNode;
  b: ReactNode;
  diff: ReactNode;
  relative: string;
}

const money = (cents: number) => <span className="num">{formatCents(cents)}</span>;

function signedCount(n: number): string {
  return n > 0 ? `+${String(n)}` : n < 0 ? `${MINUS}${String(Math.abs(n))}` : '0';
}

function rowsOf(a: Summary, b: Summary): Row[] {
  const s = t().compare.side;
  const money2 = (key: string, label: string, av: number, bv: number, flow: boolean): Row => {
    const d = delta(av, bv);
    return {
      key,
      label,
      a: money(av),
      b: money(bv),
      diff: <Amount cents={d.absolute} signed withTriangle={!flow} tone={flow ? 'neutral' : 'auto'} />,
      relative: flow && d.ratio !== null ? signedPercent(d.ratio) : '—',
    };
  };
  const months = delta(a.positiveMonths, b.positiveMonths);
  return [
    money2('net', s.net, a.netCents, b.netCents, false),
    money2('deposited', s.deposited, a.depositedCents, b.depositedCents, true),
    money2('withdrawn', s.withdrawn, a.withdrawnCents, b.withdrawnCents, true),
    {
      key: 'months',
      label: s.positiveMonths,
      a: <span className="num">{fill(s.ofTotal, { n: a.positiveMonths, total: a.months })}</span>,
      b: <span className="num">{fill(s.ofTotal, { n: b.positiveMonths, total: b.months })}</span>,
      diff: <span className="num">{signedCount(months.absolute)}</span>,
      relative: '—',
    },
    money2('avg', s.avg, a.avgMonthlyNetCents, b.avgMonthlyNetCents, false),
  ];
}

export interface DiffCardProps {
  a: SideModel;
  b: SideModel;
}

/** "Diferença": a frase do resultado líquido e uma tabela com todas as medidas, sempre A − B. */
export function DiffCard({ a, b }: DiffCardProps) {
  const d = t().compare.diff;
  const titleId = useId();
  const netDiff = a.summary.netCents - b.summary.netCents;
  const rows = rowsOf(a.summary, b.summary);
  return (
    <Card aria-labelledby={titleId}>
      <SectionHeader id={titleId} title={d.title} right={fill(d.lead, { a: a.name, b: b.name })} />
      <p className="num text-[15px] leading-relaxed">
        {fill(d.netLine, {
          a: `${a.name} ${formatCents(a.summary.netCents, { signed: true })}`,
          b: `${b.name} ${formatCents(b.summary.netCents, { signed: true })}`,
          diff: netDiff === 0 ? d.none : formatCents(netDiff, { signed: true }),
        })}
      </p>
      <div
        className="mt-4 overflow-x-auto rounded-[10px] border border-line"
        role="region"
        aria-label={fill(d.tableCaption, { a: a.name, b: b.name })}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- região com scroll tem de ser focável (axe: scrollable-region-focusable)
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">{fill(d.tableCaption, { a: a.name, b: b.name })}</caption>
          <thead>
            <tr>
              <th scope="col" className="eyebrow border-b border-line px-3 py-2 text-left font-normal">
                {d.colMetric}
              </th>
              <th scope="col" className="eyebrow border-b border-line px-3 py-2 text-right font-normal">
                {a.name}
              </th>
              <th scope="col" className="eyebrow border-b border-line px-3 py-2 text-right font-normal">
                {b.name}
              </th>
              <th scope="col" className="eyebrow border-b border-line px-3 py-2 text-right font-normal">
                {d.colDiff}
              </th>
              <th scope="col" className="eyebrow border-b border-line px-3 py-2 text-right font-normal">
                {d.colRelative}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  {r.label}
                </th>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{r.a}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{r.b}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className="inline-flex justify-end">{r.diff}</span>
                </td>
                <td className="num px-3 py-2.5 text-right whitespace-nowrap text-ink-2">{r.relative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink-2">{d.relativeNote}</p>
    </Card>
  );
}

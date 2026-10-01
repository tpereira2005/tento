import { sharedYDomain } from '../../../core/charts';
import { formatCents } from '../../../core';
import { ChartFrame, CompareLegend, CompareLines, MonthlyBars } from '../../charts';
import { t } from '../../i18n';
import { fill } from '../painel/derive';
import { axisLabel, rowLabel, type CompareModel, type SideModel } from './derive';

function countSigns(side: SideModel) {
  let positive = 0;
  let negative = 0;
  for (const p of side.monthly) {
    if (p.netCents > 0) positive += 1;
    else if (p.netCents < 0) negative += 1;
  }
  return { positive, negative };
}

/** Resultado acumulado dos dois lados no mesmo eixo, com a tabela alternativa. */
export function CumulativeCompare({ model }: { model: CompareModel }) {
  const c = t().compare.charts;
  const { a, b, aligned } = model;
  const cumA = aligned.map((m) => m.a.cumulativeCents);
  const cumB = aligned.map((m) => m.b.cumulativeCents);
  const lastA = cumA[cumA.length - 1] ?? 0;
  const lastB = cumB[cumB.length - 1] ?? 0;
  return (
    <ChartFrame
      number="01"
      title={c.cumulativeTitle}
      right={<CompareLegend a={a.name} b={b.name} />}
      table={{
        caption: fill(c.cumulativeTable, { a: a.name, b: b.name }),
        columns: [
          c.colMonth,
          fill(c.colNet, { name: a.name }),
          fill(c.colCumulative, { name: a.name }),
          fill(c.colNet, { name: b.name }),
          fill(c.colCumulative, { name: b.name }),
        ],
        rows: aligned.map((m) => [
          rowLabel(m),
          formatCents(m.a.netCents, { signed: true }),
          formatCents(m.a.cumulativeCents, { signed: true }),
          formatCents(m.b.netCents, { signed: true }),
          formatCents(m.b.cumulativeCents, { signed: true }),
        ]),
      }}
    >
      <CompareLines
        a={{ name: a.name, values: cumA }}
        b={{ name: b.name, values: cumB }}
        labels={aligned.map(axisLabel)}
        emptyText={c.noSeries}
        ariaLabel={fill(c.cumulativeAria, {
          a: a.name,
          b: b.name,
          n: aligned.length,
          valueA: formatCents(lastA),
          valueB: formatCents(lastB),
        })}
      />
      {model.sameCalendar ? null : <p className="mt-3 text-[12px] text-ink-2">{c.aligned}</p>}
    </ChartFrame>
  );
}

/** Resultado mensal: um gráfico de barras por lado, os dois com o mesmo domínio vertical. */
export function MonthlyCompare({ model }: { model: CompareModel }) {
  const c = t().compare.charts;
  const { a, b, aligned } = model;
  const yDomain = sharedYDomain([a.monthly.map((p) => p.netCents), b.monthly.map((p) => p.netCents)], 4);
  const side = (s: SideModel) => {
    const { positive, negative } = countSigns(s);
    return (
      <div key={s.name} className="min-w-0">
        <p className="mb-1 truncate text-[13px] font-medium">{s.name}</p>
        <MonthlyBars
          points={s.monthly.map((p) => ({ month: p.month, netCents: p.netCents }))}
          height={176}
          yDomain={yDomain}
          ariaLabel={fill(c.monthlyAria, { name: s.name, positive, negative })}
        />
      </div>
    );
  };
  return (
    <ChartFrame
      number="02"
      title={c.monthlyTitle}
      right={c.monthlyHint}
      table={{
        caption: fill(c.monthlyTable, { a: a.name, b: b.name }),
        columns: [c.colMonth, fill(c.colNet, { name: a.name }), fill(c.colNet, { name: b.name })],
        rows: aligned.map((m) => [
          rowLabel(m),
          formatCents(m.a.netCents, { signed: true }),
          formatCents(m.b.netCents, { signed: true }),
        ]),
      }}
    >
      <div className="flex flex-col gap-4">
        {side(a)}
        {side(b)}
      </div>
    </ChartFrame>
  );
}

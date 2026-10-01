import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { Button, Card, SectionHeader, Triangle } from '../ui';

export interface ChartTable {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ChartFrameProps {
  title: string;
  number?: string;
  right?: ReactNode;
  table: ChartTable;
  children: ReactNode;
}

/** Cartão de um gráfico: título, legenda, o gráfico e o botão que o troca por uma tabela acessível. */
export function ChartFrame({ title, number, right, table, children }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;
  const messages = t().charts;

  return (
    <Card aria-labelledby={titleId} className="min-w-0">
      <SectionHeader
        id={titleId}
        title={title}
        {...(number !== undefined ? { number } : {})}
        {...(right !== undefined ? { right } : {})}
      />
      <div id={bodyId}>
        {showTable ? (
          <div
            className="max-h-80 overflow-auto rounded-[10px] border border-line"
            role="region"
            aria-label={`${messages.tableRegion}: ${table.caption}`}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- região com scroll tem de ser focável (axe: scrollable-region-focusable)
            tabIndex={0}
          >
            <table className="w-full border-collapse text-left text-[13px]">
              <caption className="px-3 py-2 text-left text-[12px] text-ink-2">{table.caption}</caption>
              <thead>
                <tr>
                  {table.columns.map((column, i) => (
                    <th
                      key={column}
                      scope="col"
                      className={`eyebrow border-b border-line px-3 py-2 font-normal ${i === 0 ? 'text-left' : 'text-right'}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r} className="border-b border-line last:border-b-0">
                    {row.map((cellValue, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="num px-3 py-2 text-left font-normal">
                          {cellValue}
                        </th>
                      ) : (
                        <td key={c} className="num px-3 py-2 text-right">
                          {cellValue}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="quiet"
          aria-pressed={showTable}
          aria-controls={bodyId}
          onClick={() => {
            setShowTable((v) => !v);
          }}
        >
          {showTable ? messages.showChart : messages.showTable}
        </Button>
      </div>
    </Card>
  );
}

/** Legenda "▲ positivo ▼ negativo". */
export function ChartLegend() {
  const common = t().common;
  return (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <Triangle direction="up" size={9} />
        {common.positive}
      </span>
      <span className="flex items-center gap-1.5">
        <Triangle direction="down" size={9} />
        {common.negative}
      </span>
    </span>
  );
}

const HEAT_CLASSES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

/** Legenda "menos ▢▢▢▢▢ mais" do calendário. */
export function HeatLegend() {
  const messages = t().charts;
  return (
    <span className="flex items-center gap-1.5">
      {messages.less}
      {HEAT_CLASSES.map((cls) => (
        <span key={cls} aria-hidden="true" className={`inline-block h-3 w-3 rounded-[2.5px] ${cls}`} />
      ))}
      {messages.more}
    </span>
  );
}

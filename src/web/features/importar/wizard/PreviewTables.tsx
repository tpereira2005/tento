import { useState } from 'react';
import { netEffect, type TxnType } from '../../../../core';
import { t } from '../../../i18n';
import { Amount, Button, Triangle } from '../../../ui';
import { fill, formatIsoDate } from '../../definicoes/helpers';
import type { PreviewDto } from './api';
import { DataTable, type Column } from './DataTable';

const PAGE = 20;

const effectOf = (type: TxnType, amountCents: number) => netEffect({ type, amountCents });

/** Tipo com triângulo: levantamento ▲ (soma ao resultado), depósito ▼ (subtrai). */
function TypeCell({ type }: { type: TxnType }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Triangle direction={type === 'withdrawal' ? 'up' : 'down'} size={9} />
      {t().import.preview.types[type]}
    </span>
  );
}

const money = (type: TxnType, cents: number) => (
  <Amount cents={effectOf(type, cents)} signed withTriangle={false} />
);

export function IssuesTable({ issues, total }: { issues: PreviewDto['issues']; total: number }) {
  const m = t().import.preview.issues;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? issues : issues.slice(0, PAGE);
  const columns: Column<PreviewDto['issues'][number]>[] = [
    { key: 'line', label: m.columns.line, render: (i) => <span className="num">{i.line}</span> },
    { key: 'field', label: m.columns.field, render: (i) => m.fields[i.field] },
    { key: 'problem', label: m.columns.problem, render: (i) => m.codes[i.code] },
    {
      key: 'value',
      label: m.columns.value,
      render: (i) =>
        i.raw.trim() === '' ? (
          <span className="text-ink-2">{m.empty}</span>
        ) : (
          <span className="num break-all">{i.raw}</span>
        ),
    },
  ];
  const notShown = total - issues.length;
  return (
    <div>
      <DataTable
        label={m.title}
        columns={columns}
        rows={shown}
        rowKey={(i, n) => `${i.line}-${i.field}-${i.code}-${n}`}
        gridClass="sm:grid-cols-[4rem_5rem_minmax(0,1fr)_minmax(0,10rem)]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {issues.length > PAGE ? (
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((v) => !v);
            }}
          >
            {expanded ? m.showLess : fill(m.showMore, { n: issues.length - PAGE })}
          </Button>
        ) : null}
        {notShown > 0 ? (
          <p className="num text-[12px] text-ink-2">{fill(m.hidden, { n: notShown })}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ConflictsTable({ conflicts, total }: { conflicts: PreviewDto['conflicts']; total: number }) {
  const m = t().import.preview.conflicts;
  const columns: Column<PreviewDto['conflicts'][number]>[] = [
    {
      key: 'date',
      label: m.columns.date,
      render: (c) => <span className="num">{formatIsoDate(c.incoming.date)}</span>,
    },
    { key: 'type', label: m.columns.type, render: (c) => <TypeCell type={c.incoming.type} /> },
    {
      key: 'file',
      label: m.columns.file,
      end: true,
      render: (c) => money(c.incoming.type, c.incoming.amountCents),
    },
    {
      key: 'stored',
      label: m.columns.stored,
      end: true,
      render: (c) => money(c.existing.type, c.existing.amountCents),
    },
  ];
  const notShown = total - conflicts.length;
  return (
    <div>
      <DataTable
        label={m.title}
        columns={columns}
        rows={conflicts}
        rowKey={(c, n) => `${c.incoming.line}-${n}`}
        gridClass="sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)]"
      />
      {notShown > 0 ? (
        <p className="num mt-3 text-[12px] text-ink-2">{fill(m.hidden, { n: notShown })}</p>
      ) : null}
    </div>
  );
}

export function SampleTable({ rows, total }: { rows: PreviewDto['toAddSample']; total: number }) {
  const m = t().import.preview.sample;
  const columns: Column<PreviewDto['toAddSample'][number]>[] = [
    {
      key: 'date',
      label: m.columns.date,
      render: (r) => <span className="num">{formatIsoDate(r.date)}</span>,
    },
    { key: 'type', label: m.columns.type, render: (r) => <TypeCell type={r.type} /> },
    { key: 'amount', label: m.columns.amount, end: true, render: (r) => money(r.type, r.amountCents) },
  ];
  return (
    <div>
      <p className="mb-3 text-ink-2">{fill(m.intro, { shown: rows.length, total })}</p>
      <DataTable
        label={m.title}
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.line}`}
        gridClass="sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,9rem)]"
      />
    </div>
  );
}

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Alinha o conteúdo à direita (números). */
  end?: boolean;
}

interface DataTableProps<T> {
  label: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  /** Classe de `grid-template-columns` a partir de 640 px, ex.: `sm:grid-cols-[4rem_1fr]`. */
  gridClass: string;
}

/**
 * Tabela que vira lista de cartões abaixo de 640 px. Usa papéis ARIA (e não `<table>`) para a semântica
 * sobreviver à mudança de `display`; o rótulo de cada célula, no telemóvel, vem de `data-label` via CSS.
 */
export function DataTable<T>({ label, columns, rows, rowKey, gridClass }: DataTableProps<T>) {
  return (
    <div role="table" aria-label={label} className="text-[13px]">
      <div role="rowgroup">
        <div
          role="row"
          className={clsx(
            'eyebrow max-sm:sr-only sm:grid sm:gap-x-4 sm:border-b sm:border-line sm:pb-2',
            gridClass,
          )}
        >
          {columns.map((c) => (
            <div key={c.key} role="columnheader" className={clsx(c.end && 'sm:text-right')}>
              {c.label}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row, i) => (
          <div
            key={rowKey(row, i)}
            role="row"
            className={clsx(
              'flex flex-col gap-1 border-b border-line py-2.5',
              'sm:grid sm:items-baseline sm:gap-x-4 sm:gap-y-0',
              gridClass,
            )}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                role="cell"
                data-label={c.label}
                className={clsx(
                  'min-w-0 break-words',
                  'max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-3',
                  'max-sm:before:shrink-0 max-sm:before:content-[attr(data-label)]',
                  'max-sm:before:font-mono max-sm:before:text-[11px] max-sm:before:tracking-[0.08em] max-sm:before:text-ink-2 max-sm:before:uppercase',
                  c.end && 'sm:text-right',
                )}
              >
                {c.render(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

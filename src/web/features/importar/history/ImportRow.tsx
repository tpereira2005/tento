import clsx from 'clsx';
import type { ImportBatchDto } from '../../../api/types';
import { t } from '../../../i18n';
import { Button, Chip } from '../../../ui';
import { fill } from '../../definicoes/helpers';
import { accountName, formatDateTime, formatDay } from './format';

interface Props {
  batch: ImportBatchDto;
  onUndo: (batch: ImportBatchDto) => void;
}

export const rowId = (id: string) => `importacao-${id}`;

/** Uma importação: conta, ficheiro, data, contagens, estado e (se fizer sentido) a ação de desfazer. */
export function ImportRow({ batch, onUndo }: Props) {
  const m = t().importHistory;
  const undone = batch.undoneAt !== null;
  const canUndo = !undone && batch.rowsAdded > 0;
  const muted = undone ? 'text-ink-2' : '';

  const counts: [string, number][] = [
    [m.added, batch.rowsAdded],
    [m.duplicates, batch.rowsDuplicate],
    [m.conflicts, batch.rowsConflict],
    [m.invalid, batch.rowsInvalid],
  ];

  return (
    <li id={rowId(batch.id)} tabIndex={-1} className="border-t border-line py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className={clsx('font-medium break-words', muted)}>{accountName(batch)}</p>
          <p className="num mt-0.5 text-[12px] break-all text-ink-2">{batch.filename}</p>
          <p className="num mt-0.5 text-[12px] text-ink-2">
            <time dateTime={batch.createdAt}>{formatDateTime(batch.createdAt)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {undone && batch.undoneAt ? (
            <Chip>{fill(m.undoneAt, { date: formatDay(batch.undoneAt) })}</Chip>
          ) : (
            <Chip tone="pos">{m.active}</Chip>
          )}
          {canUndo ? (
            <Button
              variant="secondary"
              size="sm"
              aria-label={fill(m.undoLabel, { file: batch.filename })}
              onClick={() => {
                onUndo(batch);
              }}
            >
              {m.undo}
            </Button>
          ) : null}
        </div>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {counts.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="text-ink-2">{label}</dt>
            <dd className={clsx('num', muted)}>{value}</dd>
          </div>
        ))}
      </dl>
      {!undone && batch.rowsAdded === 0 ? (
        <p className="mt-1 text-[13px] text-ink-2">{m.nothingAdded}</p>
      ) : null}
    </li>
  );
}

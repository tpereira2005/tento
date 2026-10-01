import { clsx } from 'clsx';
import { isApiError } from '../../../api/client';
import { t } from '../../../i18n';
import { Button, Skeleton } from '../../../ui';
import { fill } from '../../definicoes/helpers';
import { fatalOf, type PreviewDto } from './api';
import { FileInfo } from './StepFile';
import { StepFrame } from './StepFrame';
import { ConflictsTable, IssuesTable, SampleTable } from './PreviewTables';
import type { LoadedFile } from './readFile';

interface Tile {
  key: keyof PreviewDto['counts'];
  label: string;
  hint?: string;
  tone?: 'neg';
}

function Tiles({ counts }: { counts: PreviewDto['counts'] }) {
  const m = t().import.preview;
  const tiles: Tile[] = [
    { key: 'total', label: m.tiles.total },
    { key: 'valid', label: m.tiles.valid },
    { key: 'toAdd', label: m.tiles.toAdd, hint: m.tileHints.toAdd },
    { key: 'duplicates', label: m.tiles.duplicates, hint: m.tileHints.duplicates },
    { key: 'conflicts', label: m.tiles.conflicts, hint: m.tileHints.conflicts },
    { key: 'invalid', label: m.tiles.invalid, hint: m.tileHints.invalid },
    { key: 'missingFromFile', label: m.tiles.missing, hint: m.tileHints.missing },
  ];
  return (
    <div role="group" aria-label={m.summary}>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((tile) => {
          const n = counts[tile.key];
          const warn = (tile.key === 'conflicts' || tile.key === 'invalid') && n > 0;
          return (
            <div
              key={tile.key}
              className={clsx('rounded-[10px] px-3.5 py-3', warn ? 'bg-neg-tint' : 'bg-surface-2')}
            >
              <dt className="eyebrow">{tile.label}</dt>
              <dd className={clsx('num mt-1 text-[26px] leading-none font-medium', warn && 'text-neg-text')}>
                {n}
              </dd>
              {tile.hint ? <dd className="mt-1.5 text-[12px] text-ink-2">{tile.hint}</dd> : null}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function formatLine(meta: PreviewDto['meta']): string {
  const m = t().import.preview;
  const delimiter =
    meta.delimiter === ';'
      ? m.delimiters.semicolon
      : meta.delimiter === ','
        ? m.delimiters.comma
        : m.delimiters.tab;
  return fill(m.format, {
    delimiter,
    decimal: m.decimals[meta.decimalHint],
    bom: meta.hadBom ? m.bom : m.noBom,
  });
}

function Fatal({
  error,
  onShowFormat,
}: {
  error: NonNullable<ReturnType<typeof fatalOf>>;
  onShowFormat: () => void;
}) {
  const m = t().import.preview.fatal;
  const text =
    error.code === 'missing_columns'
      ? fill(m.missing_columns, { list: error.missing.map((c) => m.columns[c]).join(', ') })
      : m[error.code];
  return (
    <div role="alert" className="rounded-[10px] bg-neg-tint px-4 py-3">
      <p className="font-medium text-neg-text">{m.title}</p>
      <p className="mt-1">{text}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={onShowFormat}>
        {m.seeFormat}
      </Button>
    </div>
  );
}

interface Props {
  file: LoadedFile;
  data: PreviewDto | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
  onShowFormat: () => void;
}

/** Passo 3: o que acontece se o ficheiro for importado. Nada é guardado aqui. */
export function StepPreview({ file, data, pending, error, onRetry, onBack, onNext, onShowFormat }: Props) {
  const m = t().import.preview;
  const apiProblem = isApiError(error) ? error : null;
  const fatal = apiProblem?.status === 422 ? fatalOf(apiProblem.details) : null;

  let body;
  if (error !== null && error !== undefined) {
    if (fatal) {
      body = <Fatal error={fatal} onShowFormat={onShowFormat} />;
    } else {
      const text =
        apiProblem?.status === 404
          ? m.errors.notFound
          : apiProblem?.status === 413
            ? m.errors.tooLarge
            : m.errors.generic;
      body = (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-neg-text">{text}</p>
          {apiProblem?.status === 404 ? null : (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {m.errors.retry}
            </Button>
          )}
        </div>
      );
    }
  } else if (pending || !data) {
    body = (
      <div aria-busy="true">
        <p role="status" className="mb-3 text-ink-2">
          {m.loading}
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  } else {
    const { counts } = data;
    body = (
      <div className="flex flex-col gap-6">
        <div>
          <Tiles counts={counts} />
          <p className="mt-3 text-[13px] text-ink-2">{formatLine(data.meta)}</p>
          {counts.missingFromFile > 0 ? <p className="mt-1 text-[13px] text-ink-2">{m.missingNote}</p> : null}
        </div>

        {counts.toAdd === 0 ? (
          <div role="status" className="rounded-[10px] bg-surface-2 px-4 py-3">
            <p className="font-medium">{m.nothingNew}</p>
            <p className="mt-0.5 text-[13px] text-ink-2">{m.nothingNewHint}</p>
          </div>
        ) : null}

        {data.issuesTotal > 0 ? (
          <section aria-labelledby="importar-erros-titulo">
            <h3 id="importar-erros-titulo" className="mb-1 font-display text-[18px] font-normal">
              {m.issues.title}
            </h3>
            <p className="mb-3 text-ink-2">{m.issues.intro}</p>
            <IssuesTable issues={data.issues} total={data.issuesTotal} />
          </section>
        ) : null}

        {counts.conflicts > 0 ? (
          <section aria-labelledby="importar-conflitos-titulo">
            <h3 id="importar-conflitos-titulo" className="mb-1 font-display text-[18px] font-normal">
              {m.conflicts.title}
            </h3>
            <p className="mb-3 text-ink-2">{m.conflicts.intro}</p>
            <ConflictsTable conflicts={data.conflicts} total={counts.conflicts} />
          </section>
        ) : null}

        {counts.toAdd > 0 ? (
          <section aria-labelledby="importar-novas-titulo">
            <h3 id="importar-novas-titulo" className="mb-1 font-display text-[18px] font-normal">
              {m.sample.title}
            </h3>
            <SampleTable rows={data.toAddSample} total={counts.toAdd} />
          </section>
        ) : null}
      </div>
    );
  }

  const canContinue = data !== undefined && data.counts.toAdd > 0 && !error;
  return (
    <StepFrame step="preview" title={m.title} lead={m.lead}>
      <div className="mb-5">
        <FileInfo file={file} />
      </div>
      {body}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t().import.back}
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          {t().import.next}
        </Button>
      </div>
    </StepFrame>
  );
}

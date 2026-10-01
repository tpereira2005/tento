import { FileText, Upload } from 'lucide-react';
import { useState, type ChangeEvent, type DragEvent } from 'react';
import { t } from '../../../i18n';
import { Button } from '../../../ui';
import { fill, SEP } from '../../definicoes/helpers';
import { formatBytes, loadCsvFile, type LoadedFile } from './readFile';
import { StepFrame } from './StepFrame';

/** Nome, tamanho e, se for o caso, o aviso de que o ficheiro foi lido como Windows-1252. */
export function FileInfo({ file }: { file: LoadedFile }) {
  const m = t().import.file;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <FileText size={16} strokeWidth={1.7} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span className="sr-only">{m.chosen}:</span>
        <span className="min-w-0 font-medium break-all">{file.name}</span>
        <span className="num text-[12px] text-ink-2">
          {SEP} {formatBytes(file.size)}
        </span>
      </p>
      {file.fallback ? <p className="mt-1 text-[13px] text-ink-2">{m.fallbackNotice}</p> : null}
    </div>
  );
}

interface Props {
  accountName: string;
  file: LoadedFile | null;
  onFile: (file: LoadedFile) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Passo 2: zona para largar ou escolher o CSV, com as verificações feitas no browser. */
export function StepFile({ accountName, file, onFile, onBack, onNext }: Props) {
  const m = t().import.file;
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function choose(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    setProblem(null);
    setReading(true);
    const result = await loadCsvFile(picked);
    setReading(false);
    if (result.ok) onFile(result.file);
    else setProblem(m.errors[result.problem]);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    void choose(input.files).finally(() => {
      input.value = ''; // permite escolher o mesmo ficheiro outra vez
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void choose(e.dataTransfer.files);
  }

  return (
    <StepFrame step="file" title={m.title} lead={fill(m.lead, { account: accountName })}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrastar e largar é só um extra: o input real é a via principal e funciona pelo teclado */}
      <label
        htmlFor="importar-ficheiro"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 border-dashed px-4 py-10 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
          dragging ? 'border-pos bg-pos-tint' : 'border-control bg-surface-2 hover:border-pos'
        }`}
      >
        <Upload size={24} strokeWidth={1.6} aria-hidden="true" className="text-ink-2" />
        <span className="font-medium">{dragging ? m.dropActive : m.dropTitle}</span>
        <span className="text-[13px] text-ink-2">
          {m.dropHint} {SEP} {m.accepted}
        </span>
        <input
          id="importar-ficheiro"
          type="file"
          accept=".csv,text/csv"
          aria-label={m.inputLabel}
          onChange={onChange}
          className="sr-only"
        />
      </label>

      {reading ? (
        <p role="status" className="mt-3 text-[13px] text-ink-2">
          {m.reading}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-3 font-medium text-neg-text">
          {problem}
        </p>
      ) : null}
      {file && !problem ? (
        <div className="mt-4">
          <FileInfo file={file} />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t().import.back}
        </Button>
        {file ? <Button onClick={onNext}>{t().import.next}</Button> : null}
      </div>
    </StepFrame>
  );
}

import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { fill } from '../painel/derive';
import type { ReportGenerator } from './useReportGenerator';

/**
 * Progresso, conclusão e erro da geração do PDF. A região `status` está sempre no DOM para os avisos serem
 * lidos; o contador de transações só aparece à vista (para não encher o leitor de ecrã a cada página).
 */
export function ReportStatus({ gen }: { gen: ReportGenerator }) {
  const m = t().reports;
  const collecting = gen.phase === 'collecting';
  const visible = collecting
    ? fill(m.progress.collecting, { n: gen.loaded })
    : gen.phase === 'drawing'
      ? m.progress.drawing
      : gen.phase === 'done'
        ? fill(m.progress.done, { file: gen.filename })
        : '';
  const announced = collecting ? fill(m.progress.collecting, { n: '' }).trim() : visible;
  return (
    <div className={gen.phase === 'idle' ? 'contents' : 'flex flex-col gap-3'}>
      <p role="status" className="sr-only">
        {announced}
      </p>
      {visible ? (
        <p aria-hidden="true" className="flex items-center gap-2 text-ink-2">
          {gen.running ? (
            <LoaderCircle size={16} strokeWidth={1.8} className="animate-spin motion-reduce:animate-none" />
          ) : null}
          <span className="num">{visible}</span>
        </p>
      ) : null}
      {gen.phase === 'error' ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-neg-tint px-4 py-3 text-neg-text"
        >
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1">{m.error.message}</span>
          <Button variant="secondary" size="sm" onClick={gen.retry}>
            {m.error.retry}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

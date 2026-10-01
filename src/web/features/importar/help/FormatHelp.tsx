import { ChevronRight, Download } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HEADER_ALIASES, TYPE_ALIASES } from '../../../../core/csv/headers';
import { t } from '../../../i18n';
import { Button, Card } from '../../../ui';
import { downloadSampleCsv, sampleCsvPreview } from './sample';

export interface FormatHelpProps {
  /** Âncora da secção (ligações `#formato`). */
  id?: string;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="eyebrow mb-2 text-ink-2">{title}</h3>
      <div className="flex flex-col gap-2 text-[14px]">{children}</div>
    </section>
  );
}

function Words({ words }: { words: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {words.map((w) => (
        <li key={w}>
          <code className="num rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]">{w}</code>
        </li>
      ))}
    </ul>
  );
}

/** Explicação do CSV aceite. Fechada por omissão; abre-se sozinha quando o endereço aponta para `#id`. */
export function FormatHelp({ id = 'formato' }: FormatHelpProps) {
  const m = t().importHelp;
  const summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (window.location.hash !== `#${id}`) return;
      setOpen(true);
      summary.current?.focus();
    };
    check();
    window.addEventListener('hashchange', check);
    return () => {
      window.removeEventListener('hashchange', check);
    };
  }, [id]);

  const titleId = `${id}-titulo`;

  return (
    <Card aria-labelledby={titleId} className="scroll-mt-4 py-0 sm:py-0">
      <details
        id={id}
        open={open}
        onToggle={(e) => {
          setOpen(e.currentTarget.open);
        }}
        className="group"
      >
        <summary
          ref={summary}
          className="flex cursor-pointer list-none items-center gap-3 py-4 sm:py-5 [&::-webkit-details-marker]:hidden"
        >
          <ChevronRight
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
            className="shrink-0 text-ink-2 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          <span className="min-w-0">
            <span id={titleId} className="block font-display text-[22px] leading-tight tracking-[-0.01em]">
              {m.title}
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-2">{m.hint}</span>
          </span>
        </summary>

        <div className="flex flex-col gap-4 pb-5 sm:pb-6">
          <p className="text-[14px]">{m.intro}</p>

          <Block title={m.headerTitle}>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
              <dt className="font-medium">{m.columnDate}</dt>
              <dd>
                <Words words={HEADER_ALIASES.date} />
              </dd>
              <dt className="font-medium">{m.columnType}</dt>
              <dd>
                <Words words={HEADER_ALIASES.type} />
              </dd>
              <dt className="font-medium">{m.columnAmount}</dt>
              <dd>
                <Words words={HEADER_ALIASES.amount} />
              </dd>
            </dl>
            <p className="text-[13px] text-ink-2">{m.headerNote}</p>
          </Block>

          <Block title={m.typesTitle}>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
              <dt className="font-medium">{m.typesDeposit}</dt>
              <dd>
                <Words words={TYPE_ALIASES.deposit} />
              </dd>
              <dt className="font-medium">{m.typesWithdrawal}</dt>
              <dd>
                <Words words={TYPE_ALIASES.withdrawal} />
              </dd>
            </dl>
            <p className="text-[13px] text-ink-2">{m.typesNote}</p>
          </Block>

          <Block title={m.datesTitle}>
            <p>{m.datesBody}</p>
            <p className="num text-[13px]">{m.dateFormats}</p>
            <p className="text-[13px] text-ink-2">{m.datesExample}</p>
          </Block>

          <Block title={m.amountsTitle}>
            <p>{m.amountsBody}</p>
            <p className="num text-[13px]">{m.amountsExample}</p>
          </Block>

          <Block title={m.fileTitle}>
            <p>{m.fileSeparators}</p>
            <p>{m.fileEncoding}</p>
          </Block>

          <Block title={m.duplicatesTitle}>
            <p>{m.duplicatesBody}</p>
            <p className="text-[13px] text-ink-2">{m.duplicatesSame}</p>
          </Block>

          <Block title={m.conflictsTitle}>
            <p>{m.conflictsBody}</p>
          </Block>

          <Block title={m.privacyTitle}>
            <p>{m.privacyBody}</p>
          </Block>

          <Block title={m.exampleTitle}>
            <p>{m.exampleBody}</p>
            <pre
              aria-label={m.exampleLabel}
              className="num break-words whitespace-pre-wrap rounded-[10px] bg-surface-2 px-4 py-3 text-[12px]"
            >
              {sampleCsvPreview()}
            </pre>
            <div>
              <Button variant="secondary" icon={Download} onClick={downloadSampleCsv}>
                {m.download}
              </Button>
            </div>
          </Block>
        </div>
      </details>
    </Card>
  );
}

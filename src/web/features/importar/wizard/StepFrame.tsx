import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../../i18n';
import { Card } from '../../../ui';

export type StepId = 'account' | 'file' | 'preview' | 'confirm';
export const STEPS: readonly StepId[] = ['account', 'file', 'preview', 'confirm'];

export const stepTitleId = (step: StepId) => `importar-${step}-titulo`;

/** Indicador de passos: lista ordenada, o passo atual leva `aria-current="step"`. */
export function StepIndicator({ current }: { current: StepId }) {
  const m = t().import.steps;
  const currentIndex = STEPS.indexOf(current);
  return (
    <nav aria-label={m.label}>
      <ol className="flex flex-wrap gap-x-5 gap-y-2">
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <li
              key={step}
              {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
              className={
                isCurrent
                  ? 'flex items-center gap-2 font-semibold text-ink'
                  : 'flex items-center gap-2 text-ink-2'
              }
            >
              <span
                aria-hidden="true"
                className={
                  isCurrent
                    ? 'num grid size-6 place-items-center rounded-full bg-cta text-[12px] text-cta-ink'
                    : 'num grid size-6 place-items-center rounded-full border border-control text-[12px]'
                }
              >
                {isDone ? <Check size={13} strokeWidth={2.2} aria-hidden="true" /> : i + 1}
              </span>
              <span>{m[step]}</span>
              {isDone ? <span className="sr-only">({m.done})</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepFrameProps {
  step: StepId;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}

/** Cartão de um passo; o título recebe o foco quando o passo começa. */
export function StepFrame({ step, title, lead, children }: StepFrameProps) {
  const id = stepTitleId(step);
  return (
    <Card aria-labelledby={id}>
      <div className="mb-4 flex items-baseline gap-2.5">
        <span className="num text-[11px] text-ink-2" aria-hidden="true">
          {String(STEPS.indexOf(step) + 1).padStart(2, '0')}
        </span>
        <h2
          id={id}
          tabIndex={-1}
          className="font-display text-[22px] leading-tight font-normal tracking-[-0.01em]"
        >
          {title}
        </h2>
      </div>
      {lead ? <p className="-mt-2 mb-4 text-ink-2">{lead}</p> : null}
      {children}
    </Card>
  );
}

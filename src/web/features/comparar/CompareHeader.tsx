import { t } from '../../i18n';
import { Segmented, Select, type SelectOption } from '../../ui';
import { PERIODS, type Period } from '../painel/search';
import {
  AGAINST,
  MODES,
  PRESETS,
  type Against,
  type CompareSearch,
  type Entity,
  type Mode,
  type Preset,
} from './search';

export interface CompareHeaderProps {
  mode: Mode;
  entities: readonly Entity[];
  a: string | undefined;
  b: string | undefined;
  period: Period;
  preset: Preset;
  against: Against;
  showControls: boolean;
  onChange: (patch: CompareSearch) => void;
}

/** Título e controlos: o que comparar, os dois lados e o período; tudo vive no URL. */
export function CompareHeader({
  mode,
  entities,
  a,
  b,
  period,
  preset,
  against,
  showControls,
  onChange,
}: CompareHeaderProps) {
  const c = t().compare;
  const f = t().dashboard.filters;
  const periodLabels: Record<Period, string> = { '3m': f.p3m, '6m': f.p6m, '12m': f.p12m, tudo: f.pAll };
  // O mesmo item não pode estar nos dois lados: fica visível mas desativado no outro seletor.
  const options = (other: string | undefined): SelectOption[] =>
    entities.map((e) => ({ value: e.id, label: e.name, disabled: e.id === other }));
  return (
    <header className="flex flex-col gap-5">
      <div className="min-w-0">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.02em] sm:text-[48px]">
          {c.title}
        </h1>
        <p className="mt-2.5 text-ink-2">{c.subtitle}</p>
      </div>
      {showControls ? (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            aria-label={c.modeLabel}
            value={mode}
            options={MODES.map((value) => ({ value, label: c.modes[value] }))}
            onValueChange={(modo) => {
              onChange({ modo: modo as Mode });
            }}
          />
          {mode === 'periodos' ? (
            <>
              <Segmented
                aria-label={c.periodOfA}
                value={preset}
                options={PRESETS.map((value) => ({ value, label: periodLabels[value] }))}
                onValueChange={(next) => {
                  onChange({ a: next, b: against });
                }}
              />
              <Select
                label={c.against}
                value={against}
                options={AGAINST.map((value) => ({
                  value,
                  label: value === 'anterior' ? c.againstPrevious : c.againstYear,
                }))}
                onValueChange={(next) => {
                  onChange({ a: preset, b: next });
                }}
              />
            </>
          ) : (
            <>
              <Select
                label={c.sideA}
                value={a ?? ''}
                options={options(b)}
                onValueChange={(next) => {
                  onChange({ a: next, ...(b !== undefined ? { b } : {}) });
                }}
              />
              <Select
                label={c.sideB}
                value={b ?? ''}
                options={options(a)}
                onValueChange={(next) => {
                  onChange({ ...(a !== undefined ? { a } : {}), b: next });
                }}
              />
              <Segmented
                aria-label={c.periodLabel}
                value={period}
                options={PERIODS.map((value) => ({ value, label: periodLabels[value] }))}
                onValueChange={(periodo) => {
                  onChange({ periodo: periodo as Period });
                }}
              />
            </>
          )}
        </div>
      ) : null}
    </header>
  );
}

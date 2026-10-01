import { Link } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { t } from '../../i18n';
import { Button, Segmented, Select } from '../../ui';
import { ALL_BOOKMAKERS, ALL_PROFILES, PERIODS, type DashboardSearch, type Period } from './search';
import { LINK_SECONDARY } from './States';

export interface Option {
  value: string;
  label: string;
}

export interface PainelHeaderProps {
  search: DashboardSearch;
  profiles: readonly Option[];
  bookmakers: readonly Option[];
  /** `null` enquanto os números não chegam; `false` esconde os filtros (ainda sem dados). */
  subtitle: string | null;
  showFilters: boolean;
  onChange: (patch: DashboardSearch) => void;
  /** Gera o PDF do âmbito atual. */
  onExport: () => void;
  /** Há um PDF a ser gerado (o botão fica desativado). */
  exporting: boolean;
}

/** Título, subtítulo e filtros (perfil, casa, período) do painel; os filtros vivem no URL. */
export function PainelHeader({
  search,
  profiles,
  bookmakers,
  subtitle,
  showFilters,
  onChange,
  onExport,
  exporting,
}: PainelHeaderProps) {
  const d = t().dashboard;
  const f = d.filters;
  const periodLabels: Record<Period, string> = { '3m': f.p3m, '6m': f.p6m, '12m': f.p12m, tudo: f.pAll };
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.02em] sm:text-[48px]">
          {d.title}
        </h1>
        <p className="mt-2.5 min-h-[1.4em] text-ink-2">{subtitle}</p>
      </div>
      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label={f.profile}
            value={search.perfil ?? ALL_PROFILES}
            options={[{ value: ALL_PROFILES, label: f.allProfiles }, ...profiles]}
            onValueChange={(perfil) => {
              onChange({ perfil });
            }}
          />
          <Select
            label={f.bookmaker}
            value={search.casa ?? ALL_BOOKMAKERS}
            options={[{ value: ALL_BOOKMAKERS, label: f.allBookmakers }, ...bookmakers]}
            onValueChange={(casa) => {
              onChange({ casa });
            }}
          />
          <Segmented
            aria-label={f.period}
            value={search.periodo ?? '12m'}
            options={PERIODS.map((value) => ({ value, label: periodLabels[value] }))}
            onValueChange={(periodo) => {
              onChange({ periodo: periodo as Period });
            }}
          />
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line lg:block" />
          <Link to="/importar" className={LINK_SECONDARY}>
            <Upload size={16} strokeWidth={1.8} aria-hidden="true" />
            {d.importCsv}
          </Link>
          <Button icon={Download} disabled={exporting} onClick={onExport}>
            {d.exportPdf}
          </Button>
        </div>
      ) : null}
    </header>
  );
}

import { t } from '../../i18n';
import { Segmented, Select, TextField } from '../../ui';
import type { Option } from '../painel/PainelHeader';
import { ALL_BOOKMAKERS, ALL_PROFILES, PERIODS, type Period } from '../painel/search';
import { DEFAULT_REPORT_PERIOD, hasCustomRange, type ReportSearch } from './search';

interface Props {
  search: ReportSearch;
  profiles: readonly Option[];
  bookmakers: readonly Option[];
  onChange: (patch: ReportSearch) => void;
}

/** Perfil, casa e período (atalhos ou datas De/Até) do relatório; vivem no URL. */
export function ScopeForm({ search, profiles, bookmakers, onChange }: Props) {
  const f = t().reports.scope;
  const labels: Record<Period, string> = { '3m': f.p3m, '6m': f.p6m, '12m': f.p12m, tudo: f.pAll };
  const custom = hasCustomRange(search);
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="eyebrow mb-4 text-ink-2">{f.legend}</legend>
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
          value={custom ? '' : (search.periodo ?? DEFAULT_REPORT_PERIOD)}
          options={PERIODS.map((value) => ({ value, label: labels[value] }))}
          onValueChange={(periodo) => {
            onChange({ periodo: periodo as Period, de: undefined, ate: undefined });
          }}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label={f.from}
          type="date"
          className="w-[160px]"
          value={search.de ?? ''}
          {...(search.ate ? { max: search.ate } : {})}
          onChange={(e) => {
            onChange({ de: e.target.value || undefined, periodo: undefined });
          }}
        />
        <TextField
          label={f.to}
          type="date"
          className="w-[160px]"
          value={search.ate ?? ''}
          {...(search.de ? { min: search.de } : {})}
          onChange={(e) => {
            onChange({ ate: e.target.value || undefined, periodo: undefined });
          }}
        />
        <p className="pb-2.5 text-[13px] text-ink-2">{f.rangeHint}</p>
      </div>
    </fieldset>
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { FileDown } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { api } from '../../api/client';
import { t } from '../../i18n';
import { Amount, Button, Card, SectionHeader, Skeleton } from '../../ui';
import { useBookmakers, useProfiles } from '../definicoes/api';
import type { DashboardDto } from '../painel/api';
import { periodSpan } from '../painel/derive';
import { renderTemplate } from '../painel/insightText';
import { todayIso } from '../painel/search';
import { usePageTitle } from '../shell/usePageTitle';
import { transactionCount } from './buildInput';
import { ReportStatus } from './ReportStatus';
import { ScopeForm } from './ScopeForm';
import {
  cleanReportSearch,
  parseReportSearch,
  reportQueryParams,
  resolveReportFilters,
  type ReportFilters,
  type ReportSearch,
} from './search';
import { useReportGenerator } from './useReportGenerator';

/** Números do âmbito escolhido (o mesmo endpoint do Painel), para mostrar o que o PDF vai conter. */
function usePreview(filters: ReportFilters) {
  return useQuery({
    queryKey: ['stats', 'report-preview', filters] as const,
    queryFn: () => api<DashboardDto>('/stats/dashboard', { query: reportQueryParams(filters) }),
    placeholderData: keepPreviousData,
  });
}

function PreviewCard({ filters }: { filters: ReportFilters }) {
  const m = t().reports.preview;
  const preview = usePreview(filters);
  const data = preview.data;
  let body: ReactNode;
  if (preview.isError) {
    body = <p role="alert">{m.error}</p>;
  } else if (!data) {
    body = (
      <div aria-label={m.loading} role="status">
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  } else {
    const count = data.summary.depositCount + data.summary.withdrawalCount;
    body =
      count === 0 ? (
        <p>{m.empty}</p>
      ) : (
        <p className="font-display text-[22px] leading-snug font-normal">
          {renderTemplate(m.summary, {
            period: periodSpan(data.monthly) ?? m.noPeriod,
            count: transactionCount(count),
            net: <Amount cents={data.summary.netCents} signed withTriangle />,
          })}
        </p>
      );
  }
  return (
    <Card aria-label={m.region} aria-live="polite">
      {body}
    </Card>
  );
}

function PagesCard() {
  const p = t().reports.pages;
  return (
    <Card aria-labelledby="relatorio-paginas">
      <SectionHeader title={p.title} id="relatorio-paginas" />
      <ol className="grid gap-4 sm:grid-cols-2">
        {p.items.map((item, i) => (
          <li key={item.title} className="flex gap-3">
            <span className="num mt-0.5 text-[11px] text-ink-2" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-[14px] text-ink-2">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Página Relatórios: âmbito no URL, pré-visualização dos números e geração do PDF. */
export function RelatoriosPage() {
  const m = t().reports;
  usePageTitle(m.title);
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = useMemo(() => parseReportSearch(raw as Record<string, unknown>), [raw]);
  const today = useMemo(() => todayIso(), []);
  const filters = useMemo(() => resolveReportFilters(search, today), [search, today]);
  const profiles = useProfiles();
  const bookmakers = useBookmakers();
  const gen = useReportGenerator();

  const onChange = (patch: ReportSearch) => {
    void navigate({ to: '/relatorios', search: cleanReportSearch({ ...search, ...patch }), replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.02em] sm:text-[48px]">
          {m.title}
        </h1>
        <p className="mt-2.5 max-w-2xl text-ink-2">{m.lead}</p>
      </header>
      <Card>
        <ScopeForm
          search={search}
          profiles={(profiles.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
          bookmakers={(bookmakers.data?.items ?? []).map((b) => ({ value: b.id, label: b.name }))}
          onChange={onChange}
        />
      </Card>
      <PreviewCard filters={filters} />
      <PagesCard />
      <div className="flex flex-col items-start gap-3">
        <Button
          icon={FileDown}
          disabled={gen.running}
          onClick={() => {
            void gen.run(filters);
          }}
        >
          {m.generate}
        </Button>
        <ReportStatus gen={gen} />
      </div>
    </div>
  );
}

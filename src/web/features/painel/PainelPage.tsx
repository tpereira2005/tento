import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import type { DashboardDto } from './api';
import { useDashboard, useRecentTransactions } from './api';
import type { TxnDto, WalletDto } from '../../api/types';
import { t } from '../../i18n';
import { useBookmakers, useProfiles, useWallets } from '../definicoes/api';
import { usePageTitle } from '../shell/usePageTitle';
import { AccountsCard, HousesCard } from './BreakdownCards';
import { CumulativeCard, DaysCard, MonthlyCard } from './ChartCards';
import { fill, periodSpan, plural } from './derive';
import { Hero } from './Hero';
import { InsightsCard } from './InsightsCard';
import { PainelHeader, type Option } from './PainelHeader';
import { RecentCard } from './RecentCard';
import { ScoreboardCard } from './ScoreboardCard';
import {
  cleanSearch,
  parseDashboardSearch,
  resolveFilters,
  todayIso,
  type DashboardSearch,
  type Period,
} from './search';
import { NoMovements, PainelError, PainelSkeleton, Welcome } from './States';

/** Célula da grelha: o cartão enche a altura da linha. */
function Cell({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`flex min-w-0 [&>*]:min-w-0 [&>*]:flex-1 ${className}`}>{children}</div>;
}

function Content({
  data,
  recent,
  period,
  names,
}: {
  data: DashboardDto;
  recent: readonly TxnDto[];
  period: Period;
  names: Names;
}) {
  const { summary, monthly } = data;
  return (
    <>
      <Hero summary={summary} monthly={monthly} period={period} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
        <Cell className="md:col-span-2 lg:col-span-8">
          <CumulativeCard monthly={monthly} />
        </Cell>
        <Cell className="md:col-span-2 lg:col-span-4">
          <MonthlyCard
            monthly={monthly}
            positive={summary.positiveMonths}
            negative={summary.negativeMonths}
          />
        </Cell>
        <Cell className="md:col-span-2 lg:col-span-8">
          <DaysCard days={data.heatmap} />
        </Cell>
        <Cell className="lg:col-span-4">
          <ScoreboardCard
            rows={data.breakdown.profile}
            profileName={names.profile}
            accountCount={names.accountCount}
          />
        </Cell>
        <Cell className="lg:col-span-4">
          <HousesCard
            rows={data.breakdown.bookmaker}
            wallets={names.wallets}
            bookmakerName={names.bookmaker}
          />
        </Cell>
        <Cell className="lg:col-span-4">
          <AccountsCard rows={data.breakdown.wallet} wallets={names.wallets} />
        </Cell>
        <Cell className="lg:col-span-4">
          <InsightsCard insights={data.insights} />
        </Cell>
      </div>
      <RecentCard items={recent} />
    </>
  );
}

interface Names {
  wallets: readonly WalletDto[];
  profile: (id: string) => string;
  bookmaker: (id: string) => string;
  accountCount: (profileId: string) => number;
}

/** Página Painel: filtros no URL, resumo, gráficos, repartições, destaques e últimas transações. */
export function PainelPage() {
  const d = t().dashboard;
  usePageTitle(d.title);
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = useMemo(() => parseDashboardSearch(raw as Record<string, unknown>), [raw]);
  const today = useMemo(() => todayIso(), []);
  const filters = useMemo(() => resolveFilters(search, today), [search, today]);

  const wallets = useWallets();
  const profiles = useProfiles();
  const bookmakers = useBookmakers();

  const walletList = wallets.data?.items;
  const hasAny = walletList ? walletList.some((w) => w.txnCount > 0) : undefined;
  const dashboard = useDashboard(filters, hasAny === true);
  const recent = useRecentTransactions(filters, hasAny === true);

  const profileOptions: Option[] = (profiles.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }));
  const bookmakerOptions: Option[] = (bookmakers.data?.items ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const names: Names = useMemo(() => {
    const list = walletList ?? [];
    return {
      wallets: list,
      profile: (id) => profiles.data?.items.find((p) => p.id === id)?.name ?? id,
      bookmaker: (id) => bookmakers.data?.items.find((b) => b.id === id)?.name ?? id,
      accountCount: (profileId) => list.filter((w) => w.profileId === profileId).length,
    };
  }, [walletList, profiles.data, bookmakers.data]);

  const onChange = (patch: DashboardSearch) => {
    void navigate({ to: '/', search: cleanSearch({ ...search, ...patch }) });
  };

  const data = dashboard.data;
  const subtitle = (() => {
    if (!data || !walletList) return null;
    const scoped = walletList.filter(
      (w) =>
        (!filters.profileId || w.profileId === filters.profileId) &&
        (!filters.bookmakerId || w.bookmakerId === filters.bookmakerId),
    );
    const accounts = scoped.length;
    const houses = new Set(scoped.map((w) => w.bookmakerId)).size;
    return fill(d.subtitle, {
      accounts: plural(d.accountsOne, d.accountsMany, accounts),
      houses: plural(d.housesOne, d.housesMany, houses),
      period: periodSpan(data.monthly) ?? d.allPeriod,
    });
  })();

  const retry = () => {
    void wallets.refetch();
    void dashboard.refetch();
    void recent.refetch();
  };

  let body: ReactNode;
  if (wallets.isError || dashboard.isError) {
    body = <PainelError onRetry={retry} />;
  } else if (hasAny === false) {
    body = <Welcome />;
  } else if (!data) {
    body = <PainelSkeleton />;
  } else if (data.summary.depositCount + data.summary.withdrawalCount === 0) {
    body = <NoMovements />;
  } else {
    body = <Content data={data} recent={recent.data?.items ?? []} period={filters.period} names={names} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PainelHeader
        search={search}
        profiles={profileOptions}
        bookmakers={bookmakerOptions}
        subtitle={subtitle}
        showFilters={hasAny !== false}
        onChange={onChange}
      />
      {body}
    </div>
  );
}

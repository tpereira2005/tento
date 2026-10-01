import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { TriangleAlert, UsersRound } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import type { IsoDate } from '../../../core';
import { t } from '../../i18n';
import { Button, Card, Skeleton } from '../../ui';
import { useBookmakers, useProfiles, useWallets } from '../definicoes/api';
import { DEFAULT_PERIOD, resolveFilters, todayIso } from '../painel/search';
import { LINK_SECONDARY, Welcome } from '../painel/States';
import { usePageTitle } from '../shell/usePageTitle';
import { useCompareSide } from './api';
import { CumulativeCompare, MonthlyCompare } from './CompareCharts';
import { CompareHeader } from './CompareHeader';
import { buildModel, spanLabel } from './derive';
import { DiffCard } from './DiffCard';
import { SideCard } from './SideCard';
import {
  asAgainst,
  asPreset,
  cleanSearch,
  defaultMode,
  parseCompareSearch,
  periodPair,
  resolvePair,
  type CompareSearch,
  type Entity,
  type Mode,
  type SideParams,
} from './search';

interface Side {
  name: string;
  params: SideParams;
}

function CompareSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t().compare.loading}</span>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[360px]" />
      </div>
      <Skeleton className="h-[260px]" />
    </div>
  );
}

function CompareError({ onRetry }: { onRetry: () => void }) {
  const c = t().compare;
  return (
    <Card role="alert" className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-neg-tint text-neg-text">
          <TriangleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p>{c.loadError}</p>
        <Button variant="secondary" onClick={onRetry}>
          {c.retry}
        </Button>
      </div>
    </Card>
  );
}

/** Menos de dois perfis (ou casas): explica porquê e leva às Definições. */
function NeedTwo({ mode }: { mode: Exclude<Mode, 'periodos'> }) {
  const n = t().compare.needTwo;
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
          <UsersRound size={22} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="font-display text-[22px] font-normal">
          {mode === 'perfis' ? n.profilesTitle : n.bookmakersTitle}
        </h2>
        <p className="text-ink-2">{mode === 'perfis' ? n.profilesBody : n.bookmakersBody}</p>
        <Link to="/definicoes" className={LINK_SECONDARY}>
          {n.action}
        </Link>
      </div>
    </Card>
  );
}

/** Página Comparar: dois perfis, duas casas ou dois períodos, lado a lado. O estado vive no URL. */
export function ComparePage() {
  const c = t().compare;
  usePageTitle(c.title);
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = useMemo(() => parseCompareSearch(raw as Record<string, unknown>), [raw]);
  const today = useMemo(() => todayIso(), []);

  const wallets = useWallets();
  const profiles = useProfiles();
  const bookmakers = useBookmakers();
  const walletList = wallets.data?.items;
  const hasAny = walletList ? walletList.some((w) => w.txnCount > 0) : undefined;

  const profileEntities: Entity[] = useMemo(
    () =>
      (profiles.data?.items ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        activity: (walletList ?? []).filter((w) => w.profileId === p.id).reduce((s, w) => s + w.txnCount, 0),
      })),
    [profiles.data, walletList],
  );
  const bookmakerEntities: Entity[] = useMemo(
    () =>
      (bookmakers.data?.items ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        activity: (walletList ?? [])
          .filter((w) => w.bookmakerId === b.id)
          .reduce((s, w) => s + w.txnCount, 0),
      })),
    [bookmakers.data, walletList],
  );

  const catalogReady = Boolean(walletList && profiles.data && bookmakers.data);
  const mode: Mode = search.modo ?? defaultMode(profileEntities.length, bookmakerEntities.length);
  const entities = useMemo(
    () => (mode === 'perfis' ? profileEntities : mode === 'casas' ? bookmakerEntities : []),
    [mode, profileEntities, bookmakerEntities],
  );
  const period = search.periodo ?? DEFAULT_PERIOD;
  const preset = asPreset(search.a);
  const against = asAgainst(search.b);
  const pair = mode === 'periodos' ? undefined : resolvePair(entities, search.a, search.b);

  /** Os dois lados (nome e parâmetros da API); `undefined` enquanto faltar o catálogo ou itens. */
  const sides = useMemo((): [Side, Side] | undefined => {
    if (!catalogReady) return undefined;
    if (mode === 'periodos') {
      const [pa, pb] = periodPair(preset, against, today);
      const side = (p: { from: IsoDate; to: IsoDate }): Side => ({
        name: spanLabel(p.from, p.to),
        params: { from: p.from, to: p.to },
      });
      return [side(pa), side(pb)];
    }
    if (!pair) return undefined;
    const range = resolveFilters({ periodo: period }, today);
    const side = (id: string): Side => ({
      name: entities.find((e) => e.id === id)?.name ?? id,
      params: {
        ...(mode === 'perfis' ? { profileIds: id } : { bookmakerIds: id }),
        ...(range.from ? { from: range.from } : {}),
        ...(range.to ? { to: range.to } : {}),
      },
    });
    return [side(pair[0]), side(pair[1])];
  }, [catalogReady, mode, preset, against, today, pair, period, entities]);

  const enabled = hasAny === true && sides !== undefined;
  const sideA = useCompareSide(sides?.[0].params ?? {}, enabled);
  const sideB = useCompareSide(sides?.[1].params ?? {}, enabled);

  const onChange = (patch: CompareSearch) => {
    const base: CompareSearch =
      patch.modo !== undefined && patch.modo !== mode
        ? { modo: patch.modo, ...(search.periodo ? { periodo: search.periodo } : {}) }
        : { ...search, modo: mode };
    void navigate({ to: '/comparar', search: cleanSearch({ ...base, ...patch }) });
  };

  const retry = () => {
    void wallets.refetch();
    void sideA.refetch();
    void sideB.refetch();
  };

  let body: ReactNode;
  if (wallets.isError || profiles.isError || bookmakers.isError || sideA.isError || sideB.isError) {
    body = <CompareError onRetry={retry} />;
  } else if (hasAny === false) {
    body = <Welcome />;
  } else if (catalogReady && mode !== 'periodos' && !pair) {
    body = <NeedTwo mode={mode} />;
  } else if (!sides || !sideA.data || !sideB.data) {
    body = <CompareSkeleton />;
  } else {
    const model = buildModel(
      mode,
      { name: sides[0].name, data: sideA.data },
      { name: sides[1].name, data: sideB.data },
    );
    body = (
      <>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SideCard side={model.a} eyebrow={c.sideA} line="solid" headingId="lado-a" />
          <SideCard side={model.b} eyebrow={c.sideB} line="dashed" headingId="lado-b" />
        </div>
        <DiffCard a={model.a} b={model.b} />
        {model.bothEmpty ? null : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7 [&>*]:h-full">
              <CumulativeCompare model={model} />
            </div>
            <div className="min-w-0 lg:col-span-5 [&>*]:h-full">
              <MonthlyCompare model={model} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CompareHeader
        mode={mode}
        entities={entities}
        a={pair?.[0]}
        b={pair?.[1]}
        period={period}
        preset={preset}
        against={against}
        showControls={hasAny !== false && catalogReady}
        onChange={onChange}
      />
      {body}
    </div>
  );
}

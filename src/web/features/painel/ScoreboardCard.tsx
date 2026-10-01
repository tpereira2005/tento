import { UNKNOWN_ID, type BreakdownRow } from '../../../core';
import { t } from '../../i18n';
import { Amount, Card, SectionHeader } from '../../ui';
import { fill, formatShare, plural } from './derive';
import { ShareBar } from './ShareRow';

export interface ScoreboardProps {
  /** Linhas de `breakdown.profile`. */
  rows: readonly BreakdownRow[];
  profileName: (id: string) => string;
  accountCount: (profileId: string) => number;
}

function accountsLabel(n: number): string {
  const d = t().dashboard;
  return plural(d.accountsOne, d.accountsMany, n);
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] shrink-0 place-items-center rounded-full bg-pos-tint font-display text-[13px] text-pos"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Dois perfis frente a frente, com a barra da partilha do resultado. */
function FaceToFace({
  a,
  b,
  profileName,
  accountCount,
}: { a: BreakdownRow; b: BreakdownRow } & Omit<ScoreboardProps, 'rows'>) {
  const s = t().dashboard.scoreboard;
  const side = (row: BreakdownRow, align: 'left' | 'right') => (
    <div
      className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <Avatar name={profileName(row.id)} />
      <span className="min-w-0 truncate text-ink-2">
        <span className="text-ink">{profileName(row.id)}</span> · {accountsLabel(accountCount(row.id))}
      </span>
    </div>
  );
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {side(a, 'left')}
        {side(b, 'right')}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <Amount
          cents={a.netCents}
          variant="display"
          signed
          withTriangle
          className="text-[24px] min-[420px]:text-[28px] xl:text-[30px]"
        />
        <span className="font-display text-[14px] text-ink-2 italic">{s.vs}</span>
        <Amount
          cents={b.netCents}
          variant="display"
          signed
          withTriangle
          className="text-[24px] min-[420px]:text-[28px] xl:text-[30px]"
        />
      </div>
      <div className="mt-4 flex h-1.5 overflow-hidden rounded-[3px] bg-surface-2" aria-hidden="true">
        <ShareBar share={a.share} netCents={a.netCents} strong />
        <ShareBar share={b.share} netCents={b.netCents} className="border-l-2 border-surface" />
      </div>
      <div className="eyebrow mt-2 flex justify-between normal-case">
        <span>{fill(s.shareOfResult, { share: formatShare(a.share) })}</span>
        <span>{formatShare(b.share)}</span>
      </div>
    </div>
  );
}

/**
 * 04 — Perfis. Dois perfis: frente a frente. Um: o resultado desse perfil. Três ou mais: lista por
 * ordem de impacto (a generalização honesta do "A vs B").
 */
export function ScoreboardCard({ rows, profileName, accountCount }: ScoreboardProps) {
  const s = t().dashboard.scoreboard;
  const known = rows.filter((r) => r.id !== UNKNOWN_ID);
  const [first, second] = known;
  if (!first) return null;

  const title =
    known.length === 1
      ? profileName(first.id)
      : known.length === 2 && second
        ? fill(s.versus, { a: profileName(first.id), b: profileName(second.id) })
        : s.ranking;

  return (
    <Card aria-labelledby="placar-titulo" className="h-full">
      <SectionHeader
        number="04"
        id="placar-titulo"
        title={title}
        right={<span className="eyebrow">{s.eyebrow}</span>}
      />
      {known.length === 1 ? (
        <div>
          <p className="text-ink-2">{accountsLabel(accountCount(first.id))}</p>
          <div className="mt-2">
            <Amount
              cents={first.netCents}
              variant="display"
              signed
              withTriangle
              className="text-[36px] xl:text-[44px]"
            />
          </div>
        </div>
      ) : known.length === 2 && second ? (
        <FaceToFace a={first} b={second} profileName={profileName} accountCount={accountCount} />
      ) : (
        <ol className="flex flex-col gap-3">
          {known.map((row) => (
            <li key={row.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {profileName(row.id)}{' '}
                  <span className="text-ink-2">· {accountsLabel(accountCount(row.id))}</span>
                </span>
                <Amount cents={row.netCents} withTriangle signed />
              </div>
              <div className="mt-2 flex items-center gap-3" aria-hidden="true">
                <div className="flex h-1.5 flex-1 rounded-[3px] bg-surface-2">
                  <ShareBar share={row.share} netCents={row.netCents} strong className="rounded-[3px]" />
                </div>
                <span className="num w-10 text-right text-[12px] text-ink-2">{formatShare(row.share)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

import { Link } from '@tanstack/react-router';
import { UNKNOWN_ID, type BreakdownRow } from '../../../core';
import type { WalletDto } from '../../api/types';
import { t } from '../../i18n';
import { Amount, Card, SectionHeader } from '../../ui';
import { fill, isoDateOfTimestamp, plural } from './derive';
import { ShareRow } from './ShareRow';

const SEP = ' · ';

/** 05 — Por casa: uma linha por casa, com os perfis que lá têm conta e o total. */
export function HousesCard({
  rows,
  wallets,
  bookmakerName,
}: {
  rows: readonly BreakdownRow[];
  wallets: readonly WalletDto[];
  bookmakerName: (id: string) => string;
}) {
  const d = t().dashboard;
  const known = rows.filter((r) => r.id !== UNKNOWN_ID);
  const total = known.reduce((sum, r) => sum + r.netCents, 0);
  return (
    <Card aria-labelledby="casas-titulo" className="h-full">
      <SectionHeader
        number="05"
        id="casas-titulo"
        title={d.houses.title}
        right={
          <Link to="/definicoes" className="font-medium text-pos underline-offset-4 hover:underline">
            {d.houses.manage}
          </Link>
        }
      />
      <ul>
        {known.map((row) => {
          const here = wallets.filter((w) => w.bookmakerId === row.id);
          const people = [...new Set(here.map((w) => w.profileName))].sort((a, b) =>
            a.localeCompare(b, 'pt'),
          );
          return (
            <ShareRow
              key={row.id}
              name={bookmakerName(row.id)}
              sub={`${people.join(', ')}${SEP}${plural(d.accountsOne, d.accountsMany, here.length)}`}
              netCents={row.netCents}
              share={row.share}
            />
          );
        })}
      </ul>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{d.houses.total}</span>
        <Amount cents={total} signed className="font-semibold" />
      </div>
    </Card>
  );
}

/** 07 — Contas (perfil · casa), com a data da última importação. */
export function AccountsCard({
  rows,
  wallets,
}: {
  rows: readonly BreakdownRow[];
  wallets: readonly WalletDto[];
}) {
  const d = t().dashboard;
  const byId = new Map(wallets.map((w) => [w.id, w]));
  const known = rows.filter((r) => r.id !== UNKNOWN_ID);
  return (
    <Card aria-labelledby="contas-titulo" className="h-full">
      <SectionHeader
        number="07"
        id="contas-titulo"
        title={d.accounts.title}
        right={<span className="eyebrow">{d.accounts.eyebrow}</span>}
      />
      <ul>
        {known.map((row) => {
          const wallet = byId.get(row.id);
          return (
            <ShareRow
              key={row.id}
              name={wallet ? `${wallet.profileName}${SEP}${wallet.bookmakerName}` : row.id}
              sub={
                wallet?.lastImportAt
                  ? fill(d.accounts.imported, { date: isoDateOfTimestamp(wallet.lastImportAt) })
                  : d.accounts.neverImported
              }
              netCents={row.netCents}
              share={row.share}
            />
          );
        })}
      </ul>
    </Card>
  );
}

import { Link } from '@tanstack/react-router';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine } from 'lucide-react';
import { formatCents, netEffect } from '../../../core';
import type { TxnDto } from '../../api/types';
import { t } from '../../i18n';
import { Amount, Card, SectionHeader } from '../../ui';
import { formatIsoDate } from '../definicoes/helpers';

const TH = 'eyebrow border-b border-line py-2 font-normal';

/** 08 — Últimas transações: tabela em ecrãs largos; no móvel a conta e a data passam para baixo do tipo. */
export function RecentCard({ items }: { items: readonly TxnDto[] }) {
  const d = t().dashboard;
  const r = d.recent;
  return (
    <Card aria-labelledby="recentes-titulo">
      <SectionHeader
        number="08"
        id="recentes-titulo"
        title={r.title}
        right={
          <Link
            to="/transacoes"
            className="inline-flex items-center gap-1.5 font-medium text-pos underline-offset-4 hover:underline"
          >
            {r.all}
            <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        }
      />
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{r.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${TH} hidden w-[18%] text-left sm:table-cell`}>
              {r.colDate}
            </th>
            <th scope="col" className={`${TH} text-left`}>
              {r.colType}
            </th>
            <th scope="col" className={`${TH} hidden text-left sm:table-cell`}>
              {r.colAccount}
            </th>
            <th scope="col" className={`${TH} hidden text-right sm:table-cell`}>
              {r.colAmount}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {r.colEffect}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((txn) => {
            const deposit = txn.type === 'deposit';
            const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine;
            const account = `${txn.profileName} · ${txn.bookmakerName}`;
            const date = formatIsoDate(String(txn.date));
            return (
              <tr key={txn.id} className="border-b border-line last:border-b-0">
                <td className="num hidden py-3 text-[13px] sm:table-cell">{date}</td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 sm:size-auto sm:bg-transparent">
                      <Icon size={16} strokeWidth={1.6} aria-hidden={true} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium sm:font-normal">{deposit ? r.deposit : r.withdrawal}</div>
                      <div className="num text-[12px] text-ink-2 sm:hidden">
                        {account} · {date}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden py-3 sm:table-cell">{account}</td>
                <td className="num hidden py-3 text-right sm:table-cell">{formatCents(txn.amountCents)}</td>
                <td className="py-3 text-right">
                  <Amount cents={netEffect(txn)} signed withTriangle className="text-[14px]" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

import { Pencil, Trash2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { formatCents, netEffect } from '../../../core';
import type { TxnDto } from '../../api/types';
import { t } from '../../i18n';
import { Amount, Button, Card, Chip, Triangle } from '../../ui';
import { fill, formatIsoDate } from '../definicoes/helpers';

const DESKTOP_QUERY = '(min-width: 768px)';

/** `true` a partir de 768 px (e onde não há `matchMedia`, como nos testes em jsdom). */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener('change', notify);
      return () => {
        mq.removeEventListener('change', notify);
      };
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY).matches : true),
    () => true,
  );
}

interface Props {
  items: readonly TxnDto[];
  onEdit: (txn: TxnDto) => void;
  onDelete: (txn: TxnDto) => void;
}

function useRowText() {
  const r = t().transactions.table;
  return (txn: TxnDto) => {
    const deposit = txn.type === 'deposit';
    const date = formatIsoDate(String(txn.date));
    const amount = formatCents(txn.amountCents);
    return {
      deposit,
      date,
      amount,
      typeLabel: deposit ? r.deposit : r.withdrawal,
      account: `${txn.profileName} · ${txn.bookmakerName}`,
      origin: txn.source === 'csv' ? r.sourceCsv : r.sourceManual,
      editLabel: fill(r.edit, { date, amount }),
      removeLabel: fill(r.remove, { date, amount }),
    };
  };
}

function Actions({ txn, onEdit, onDelete }: { txn: TxnDto } & Pick<Props, 'onEdit' | 'onDelete'>) {
  const text = useRowText()(txn);
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        variant="quiet"
        icon={Pencil}
        className="size-10 px-0"
        aria-label={text.editLabel}
        onClick={() => {
          onEdit(txn);
        }}
      />
      <Button
        variant="quiet"
        icon={Trash2}
        className="size-10 px-0"
        aria-label={text.removeLabel}
        onClick={() => {
          onDelete(txn);
        }}
      />
    </div>
  );
}

/** Seta do efeito: depósito tira dinheiro do resultado (▼), levantamento acrescenta (▲). */
function TypeCell({ deposit, label }: { deposit: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Triangle direction={deposit ? 'down' : 'up'} size={9} />
      {label}
    </span>
  );
}

const TH =
  'eyebrow sticky top-16 z-10 border-b border-line bg-surface py-2.5 pr-3 text-left font-normal first:pl-0 last:pr-0';
const TD = 'border-b border-line py-3 pr-3 align-top first:pl-0 last:pr-0';

function Table({ items, onEdit, onDelete }: Props) {
  const r = t().transactions.table;
  const text = useRowText();
  return (
    <table className="w-full border-separate border-spacing-0 text-left">
      <caption className="sr-only">{r.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${TH} w-[11%]`}>
            {r.colDate}
          </th>
          <th scope="col" className={`${TH} w-[20%]`}>
            {r.colAccount}
          </th>
          <th scope="col" className={`${TH} w-[14%]`}>
            {r.colType}
          </th>
          <th scope="col" className={`${TH} w-[11%] text-right`}>
            {r.colAmount}
          </th>
          <th scope="col" className={`${TH} w-[11%] text-right`}>
            {r.colEffect}
          </th>
          <th scope="col" className={`${TH} w-[9%]`}>
            {r.colOrigin}
          </th>
          <th scope="col" className={TH}>
            {r.colNote}
          </th>
          <th scope="col" className={`${TH} w-[120px]`}>
            <span className="sr-only">{r.colActions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((txn) => {
          const x = text(txn);
          return (
            <tr key={txn.id}>
              <td className={`${TD} num text-[13px]`}>{x.date}</td>
              <td className={`${TD} break-words`}>{x.account}</td>
              <td className={TD}>
                <TypeCell deposit={x.deposit} label={x.typeLabel} />
              </td>
              <td className={`${TD} num text-right`}>{x.amount}</td>
              <td className={`${TD} text-right`}>
                <Amount cents={netEffect(txn)} signed />
              </td>
              <td className={TD}>
                <Chip>{x.origin}</Chip>
              </td>
              <td className={`${TD} break-words text-ink-2`}>
                {txn.note ?? (
                  <>
                    <span aria-hidden="true">{'–'}</span>
                    <span className="sr-only">{r.noNote}</span>
                  </>
                )}
              </td>
              <td className={TD}>
                <Actions txn={txn} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Stacked({ items, onEdit, onDelete }: Props) {
  const r = t().transactions.table;
  const text = useRowText();
  return (
    <ul aria-label={r.list}>
      {items.map((txn) => {
        const x = text(txn);
        return (
          <li
            key={txn.id}
            className="flex flex-col gap-1.5 border-b border-line py-3 first:pt-0 last:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">
                <TypeCell deposit={x.deposit} label={x.typeLabel} />
              </span>
              <Amount cents={netEffect(txn)} signed />
            </div>
            <div className="num text-[12px] break-words text-ink-2">
              {x.account} · {x.date}
            </div>
            <div className="num text-[13px]">{x.amount}</div>
            <div className="flex items-start gap-2">
              <Chip className="shrink-0">{x.origin}</Chip>
              {txn.note ? <p className="min-w-0 text-[13px] break-words text-ink-2">{txn.note}</p> : null}
            </div>
            <Actions txn={txn} onEdit={onEdit} onDelete={onDelete} />
          </li>
        );
      })}
    </ul>
  );
}

/** Tabela em ecrãs largos; lista empilhada abaixo de 768 px. */
export function TransactionList(props: Props) {
  const desktop = useIsDesktop();
  return <Card className="p-4 sm:p-6">{desktop ? <Table {...props} /> : <Stacked {...props} />}</Card>;
}

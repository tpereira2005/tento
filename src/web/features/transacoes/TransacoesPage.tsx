import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, Upload } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { TxnDto } from '../../api/types';
import { t } from '../../i18n';
import { Button } from '../../ui';
import { fill } from '../definicoes/helpers';
import { useBookmakers, useProfiles, useWallets } from '../definicoes/api';
import { todayIso } from '../painel/search';
import { LINK_SECONDARY } from '../painel/States';
import { usePageTitle } from '../shell/usePageTitle';
import { useTransactionPages, useTransactionSums } from './api';
import { DeleteDialog } from './DeleteDialog';
import {
  cleanSearch,
  hasActiveFilters,
  parseTransactionsSearch,
  resolveFilters,
  type TransactionsSearch,
} from './search';
import { ListError, ListSkeleton, NoResults, NoTransactions } from './States';
import { Sums } from './Sums';
import { TransactionDialog, type DialogMode } from './TransactionDialog';
import { TransactionList } from './TransactionList';
import { TransactionsFilters } from './TransactionsFilters';

const NBSP = String.fromCharCode(0xa0);

type Dialogs = { kind: 'form'; mode: DialogMode } | { kind: 'delete'; txn: TxnDto } | null;

/** Página Transações: filtros no URL, lista paginada por cursor e formulários de adicionar, editar e apagar. */
export function TransacoesPage() {
  const m = t().transactions;
  usePageTitle(m.title);
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = useMemo(() => parseTransactionsSearch(raw as Record<string, unknown>), [raw]);
  const today = useMemo(() => todayIso(), []);
  const filters = useMemo(() => resolveFilters(search, today), [search, today]);

  const profiles = useProfiles();
  const bookmakers = useBookmakers();
  const wallets = useWallets();
  const pages = useTransactionPages(filters);
  const sums = useTransactionSums(filters);

  const [dialog, setDialog] = useState<Dialogs>(null);
  const [notice, setNotice] = useState('');
  // alternar um espaço final faz o leitor de ecrã repetir avisos iguais
  const announce = useCallback((message: string) => {
    setNotice((prev) => (prev === message ? `${message}${NBSP}` : message));
  }, []);
  const progress = useRef<HTMLParagraphElement>(null);

  const onChange = useCallback(
    (patch: Partial<TransactionsSearch>) => {
      void navigate({ to: '/transacoes', search: cleanSearch({ ...search, ...patch }), replace: true });
    },
    [navigate, search],
  );
  const clear = () => {
    void navigate({ to: '/transacoes', search: {} });
  };

  const items = useMemo(() => pages.data?.pages.flatMap((p) => p.items) ?? [], [pages.data]);
  const total = pages.data?.pages[0]?.total ?? 0;
  const walletList = wallets.data?.items ?? [];
  const filtered = hasActiveFilters(search);

  async function loadMore() {
    const result = await pages.fetchNextPage();
    const loaded = result.data?.pages.reduce((n, p) => n + p.items.length, 0) ?? 0;
    announce(fill(m.more.loaded, { count: loaded, total: result.data?.pages[0]?.total ?? total }));
    if (!result.hasNextPage) progress.current?.focus();
  }

  const openAdd = () => {
    setDialog({ kind: 'form', mode: { kind: 'create' } });
  };

  let body;
  if (pages.isError) {
    body = (
      <ListError
        onRetry={() => {
          void pages.refetch();
          void sums.refetch();
        }}
      />
    );
  } else if (!pages.data) {
    body = <ListSkeleton />;
  } else if (items.length === 0) {
    body = filtered ? <NoResults onClear={clear} /> : <NoTransactions onAdd={openAdd} />;
  } else {
    body = (
      <>
        <TransactionList
          items={items}
          onEdit={(txn) => {
            setDialog({ kind: 'form', mode: { kind: 'edit', txn } });
          }}
          onDelete={(txn) => {
            setDialog({ kind: 'delete', txn });
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <p ref={progress} tabIndex={-1} className="num text-[12px] text-ink-2 outline-none">
            {fill(m.more.progress, { count: items.length, total })}
          </p>
          {pages.hasNextPage ? (
            <Button variant="secondary" disabled={pages.isFetchingNextPage} onClick={() => void loadMore()}>
              {pages.isFetchingNextPage ? m.more.loading : m.more.button}
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  const count = pages.data ? (total === 1 ? m.countOne : fill(m.countMany, { n: total })) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.02em] sm:text-[48px]">
            {m.title}
          </h1>
          <p aria-live="polite" className="num mt-2.5 min-h-[1.4em] text-ink-2">
            {count}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/importar" className={LINK_SECONDARY}>
            <Upload size={16} strokeWidth={1.8} aria-hidden="true" />
            {m.importCsv}
          </Link>
          <Button icon={Plus} onClick={openAdd}>
            {m.add}
          </Button>
        </div>
      </header>

      <TransactionsFilters
        search={search}
        profiles={(profiles.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
        bookmakers={(bookmakers.data?.items ?? []).map((b) => ({ value: b.id, label: b.name }))}
        wallets={walletList}
        onChange={onChange}
      />

      <Sums summary={sums.data} partial={filters.type !== undefined || filters.q !== undefined} />

      {body}

      {dialog?.kind === 'form' ? (
        <TransactionDialog
          mode={dialog.mode}
          wallets={walletList}
          today={today}
          defaultWalletId={filters.walletId}
          onClose={() => {
            setDialog(null);
          }}
          announce={announce}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <DeleteDialog
          txn={dialog.txn}
          onClose={() => {
            setDialog(null);
          }}
          announce={announce}
        />
      ) : null}

      <div role="status" aria-live="polite" aria-label={m.announce.region} className="sr-only">
        {notice}
      </div>
    </div>
  );
}

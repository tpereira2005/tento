import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WalletDto } from '../../api/types';
import { t } from '../../i18n';
import { Segmented, Select, TextField } from '../../ui';
import type { Option } from '../painel/PainelHeader';
import { ALL_BOOKMAKERS, ALL_PROFILES, PERIODS, type Period } from '../painel/search';
import { ALL_ACCOUNTS, ALL_TYPES, DEFAULT_PERIOD, hasCustomRange, type TransactionsSearch } from './search';
import { walletLabel } from './TransactionDialog';

export const SEARCH_DEBOUNCE_MS = 300;

interface Props {
  search: TransactionsSearch;
  profiles: readonly Option[];
  bookmakers: readonly Option[];
  wallets: readonly WalletDto[];
  onChange: (patch: Partial<TransactionsSearch>) => void;
}

/** Pesquisa nas notas: escreve-se à vontade e o URL só muda 300 ms depois da última tecla. */
function NoteSearch({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const f = t().transactions.filters;
  const [text, setText] = useState(value);
  const pushed = useRef(value);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  // Mudanças vindas de fora (por exemplo, "Limpar filtros") passam para o campo.
  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const q = text.trim();
    if (q === pushed.current) return;
    const timer = window.setTimeout(() => {
      pushed.current = q;
      latest.current(q);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [text]);

  return (
    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
      <TextField
        label={f.search}
        hideLabel
        type="search"
        placeholder={f.search}
        autoComplete="off"
        maxLength={100}
        value={text}
        className="[&_input]:pl-9"
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <Search
        size={16}
        strokeWidth={1.8}
        aria-hidden="true"
        className="pointer-events-none absolute top-[12px] left-3 text-ink-2"
      />
    </div>
  );
}

/** Filtros no URL: perfil, casa, conta, tipo, período (ou datas) e pesquisa nas notas. */
export function TransactionsFilters({ search, profiles, bookmakers, wallets, onChange }: Props) {
  const f = t().transactions.filters;
  const periodLabels: Record<Period, string> = { '3m': f.p3m, '6m': f.p6m, '12m': f.p12m, tudo: f.pAll };
  const custom = hasCustomRange(search);

  const profile = search.perfil ?? ALL_PROFILES;
  const bookmaker = search.casa ?? ALL_BOOKMAKERS;
  // as contas oferecidas respeitam o perfil e a casa já escolhidos
  const accountOptions = wallets
    .filter(
      (w) =>
        (profile === ALL_PROFILES || w.profileId === profile) &&
        (bookmaker === ALL_BOOKMAKERS || w.bookmakerId === bookmaker),
    )
    .map((w) => ({ value: w.id, label: walletLabel(w) }));
  const account = search.conta ?? ALL_ACCOUNTS;
  const accountValue = accountOptions.some((o) => o.value === account) ? account : ALL_ACCOUNTS;

  return (
    <div role="group" aria-label={f.region} className="flex flex-wrap items-end gap-2">
      <Select
        label={f.profile}
        value={profile}
        options={[{ value: ALL_PROFILES, label: f.allProfiles }, ...profiles]}
        onValueChange={(perfil) => {
          onChange({ perfil });
        }}
      />
      <Select
        label={f.bookmaker}
        value={bookmaker}
        options={[{ value: ALL_BOOKMAKERS, label: f.allBookmakers }, ...bookmakers]}
        onValueChange={(casa) => {
          onChange({ casa });
        }}
      />
      <Select
        label={f.account}
        value={accountValue}
        options={[{ value: ALL_ACCOUNTS, label: f.allAccounts }, ...accountOptions]}
        onValueChange={(conta) => {
          onChange({ conta });
        }}
      />
      <Select
        label={f.type}
        value={search.tipo ?? ALL_TYPES}
        options={[
          { value: ALL_TYPES, label: f.allTypes },
          { value: 'deposit', label: f.deposit },
          { value: 'withdrawal', label: f.withdrawal },
        ]}
        onValueChange={(tipo) => {
          onChange({ tipo: tipo as TransactionsSearch['tipo'] });
        }}
      />
      <Segmented
        aria-label={f.period}
        value={custom ? '' : (search.periodo ?? DEFAULT_PERIOD)}
        options={PERIODS.map((value) => ({ value, label: periodLabels[value] }))}
        onValueChange={(periodo) => {
          onChange({ periodo: periodo as Period, de: undefined, ate: undefined });
        }}
      />
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
      <NoteSearch
        value={search.q ?? ''}
        onChange={(q) => {
          onChange({ q });
        }}
      />
    </div>
  );
}

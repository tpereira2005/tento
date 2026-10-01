import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';
import { isApiError } from '../../api/client';
import type { WalletDto } from '../../api/types';
import { t } from '../../i18n';
import { Button, Dialog, Select } from '../../ui';
import { useBookmakers, useCreateWallet, useDeleteWallet, useProfiles, useWallets } from './api';
import { errorMessage, fill, formatIsoDate, SEP } from './helpers';
import { SectionFrame } from './SectionFrame';

interface Props {
  announce: (message: string) => void;
}

/** `Serialized` não conhece tipos de marca: a data chega da API como texto `AAAA-MM-DD`. */
const isoText = (d: WalletDto['lastTxnDate']) => d as unknown as string;

const walletName = (w: WalletDto) => `${w.profileName} ${SEP} ${w.bookmakerName}`;

/** Secção de contas (perfil × casa): lista com estatísticas, criar e apagar. */
export function WalletsSection({ announce }: Props) {
  const s = t().settings;
  const m = s.wallets;
  const profiles = useProfiles();
  const bookmakers = useBookmakers();
  const wallets = useWallets();
  const create = useCreateWallet();
  const remove = useDeleteWallet();

  const [profileId, setProfileId] = useState('');
  const [bookmakerId, setBookmakerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<WalletDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const focusCreateOnClose = useRef(false);

  const profileList = profiles.data?.items ?? [];
  const bookmakerList = bookmakers.data?.items ?? [];
  const walletList = wallets.data?.items ?? [];

  // Sem escolha explícita (ou com o item apagado), sugere a primeira combinação que ainda não existe,
  // para o formulário não abrir já com o aviso "Esta conta já existe.".
  const taken = (p: string, b: string) => walletList.some((w) => w.profileId === p && w.bookmakerId === b);
  const firstFreeFor = (p: string) => bookmakerList.find((b) => !taken(p, b.id));
  const selectedProfile =
    profileList.find((p) => p.id === profileId) ??
    profileList.find((p) => firstFreeFor(p.id) !== undefined) ??
    profileList[0];
  const selectedBookmaker =
    bookmakerList.find((b) => b.id === bookmakerId) ??
    (selectedProfile ? firstFreeFor(selectedProfile.id) : undefined) ??
    bookmakerList[0];
  const ready = selectedProfile !== undefined && selectedBookmaker !== undefined;

  const ofProfile = selectedProfile ? walletList.filter((w) => w.profileId === selectedProfile.id) : [];
  const exists =
    ready &&
    walletList.some((w) => w.profileId === selectedProfile.id && w.bookmakerId === selectedBookmaker.id);

  /** Foco no primeiro controlo do formulário (o botão pode estar desativado). */
  function focusForm() {
    form.current?.querySelector<HTMLElement>('button')?.focus();
  }

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!ready || exists) return;
    create.mutate(
      { profileId: selectedProfile.id, bookmakerId: selectedBookmaker.id },
      {
        onSuccess: () => {
          setError(null);
          announce(m.created);
          focusForm();
        },
        onError: (err) => {
          setError(errorMessage(err, m.duplicate));
        },
      },
    );
  }

  function confirmDelete() {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => {
        focusCreateOnClose.current = true;
        setTarget(null);
        announce(m.deleted);
      },
      onError: (err) => {
        if (isApiError(err, 'not_found')) {
          focusCreateOnClose.current = true;
          setTarget(null);
          void wallets.refetch();
        }
        setDeleteError(errorMessage(err, m.duplicate));
      },
    });
  }

  const loading = profiles.isPending || bookmakers.isPending || wallets.isPending;
  const failed = profiles.isError || bookmakers.isError || wallets.isError;

  return (
    <SectionFrame
      idPrefix="contas"
      number={m.number}
      title={m.title}
      hint={m.hint}
      loading={loading}
      failed={failed}
      onRetry={() => {
        for (const q of [profiles, bookmakers, wallets]) if (q.isError) void q.refetch();
      }}
    >
      {walletList.length === 0 ? (
        <div className="mb-5 rounded-[10px] bg-surface-2 px-4 py-3">
          <p className="font-medium">{m.empty}</p>
          {ready ? <p className="mt-0.5 text-[13px] text-ink-2">{m.emptyHint}</p> : null}
        </div>
      ) : (
        <ul aria-label={m.list} className="mb-5 border-b border-line">
          {walletList.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line py-2"
            >
              <span className="min-w-0 break-words font-medium">{walletName(w)}</span>
              <span className="num ml-auto text-[12px] text-ink-2">
                {w.txnCount === 0
                  ? m.noTxns
                  : `${w.txnCount === 1 ? m.txnOne : fill(m.txnMany, { count: w.txnCount })}${w.lastTxnDate ? ` ${SEP} ${fill(m.lastTxn, { date: formatIsoDate(isoText(w.lastTxnDate)) })}` : ''}`}
              </span>
              <Button
                variant="quiet"
                icon={Trash2}
                aria-label={fill(s.remove, { name: walletName(w) })}
                onClick={() => {
                  setDeleteError(null);
                  setTarget(w);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <form ref={form} onSubmit={submit} className="flex flex-wrap items-center gap-2">
        {ready ? (
          <>
            <Select
              label={m.profileLabel}
              options={profileList.map((p) => ({ value: p.id, label: p.name }))}
              value={selectedProfile.id}
              onValueChange={(v) => {
                setProfileId(v);
                setError(null);
              }}
            />
            <Select
              label={m.bookmakerLabel}
              options={bookmakerList.map((b) => ({ value: b.id, label: b.name }))}
              value={selectedBookmaker.id}
              onValueChange={(v) => {
                setBookmakerId(v);
                setError(null);
              }}
            />
          </>
        ) : null}
        <Button
          type="submit"
          icon={Plus}
          disabled={!ready || exists || create.isPending}
          aria-describedby={!ready ? 'contas-ajuda' : exists ? 'contas-existe' : undefined}
        >
          {m.addButton}
        </Button>
      </form>
      {!ready ? (
        <p id="contas-ajuda" className="mt-3 text-[13px] text-ink-2">
          {m.needBoth}
        </p>
      ) : (
        <div className="mt-3 text-[13px] text-ink-2">
          <p>
            {ofProfile.length === 0
              ? fill(m.noneFor, { profile: selectedProfile.name })
              : fill(m.existsFor, {
                  profile: selectedProfile.name,
                  list: ofProfile.map((w) => w.bookmakerName).join(', '),
                })}
          </p>
          {exists ? (
            <p id="contas-existe" className="mt-1 font-medium text-neg-text">
              {m.duplicate}
            </p>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-neg-text">
          {error}
        </p>
      ) : null}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={fill(m.deleteTitle, { name: target ? walletName(target) : '' })}
        description={m.deleteBody}
        onCloseAutoFocus={(e) => {
          if (focusCreateOnClose.current) {
            focusCreateOnClose.current = false;
            e.preventDefault();
            focusForm();
          }
        }}
      >
        {deleteError ? (
          <p role="alert" className="mb-3 text-[13px] font-medium text-neg-text">
            {deleteError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setTarget(null);
            }}
          >
            {s.cancel}
          </Button>
          <Button onClick={confirmDelete} disabled={remove.isPending}>
            {m.deleteConfirm}
          </Button>
        </div>
      </Dialog>
    </SectionFrame>
  );
}

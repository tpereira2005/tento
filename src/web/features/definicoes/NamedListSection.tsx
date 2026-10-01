import { Plus } from 'lucide-react';
import { useRef, useState, type SyntheticEvent } from 'react';
import { isApiError } from '../../api/client';
import { t } from '../../i18n';
import { Button, Dialog, TextField } from '../../ui';
import { useBookmakers, useCreateNamed, useDeleteNamed, useProfiles } from './api';
import { errorMessage, fill, isValidName } from './helpers';
import { NamedRow, type NamedItem, type NamedMessages } from './NamedRow';
import { SectionFrame } from './SectionFrame';

interface Props {
  kind: 'bookmakers' | 'profiles';
  announce: (message: string) => void;
}

/** Secção de casas ou perfis: lista com renomear/apagar e formulário de adicionar. */
export function NamedListSection({ kind, announce }: Props) {
  const s = t().settings;
  const m: NamedMessages = s[kind];
  const bookmakers = useBookmakers();
  const profiles = useProfiles();
  const query = kind === 'bookmakers' ? bookmakers : profiles;
  const create = useCreateNamed(kind);
  const remove = useDeleteNamed(kind);

  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [target, setTarget] = useState<NamedItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const addField = useRef<HTMLInputElement>(null);
  const focusAddOnClose = useRef(false);

  const items: NamedItem[] = query.data?.items ?? [];

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!isValidName(name)) {
      setAddError(s.errors.invalidName);
      addField.current?.focus();
      return;
    }
    create.mutate(name.trim(), {
      onSuccess: () => {
        setName('');
        setAddError(null);
        announce(m.created);
        addField.current?.focus();
      },
      onError: (err) => {
        setAddError(errorMessage(err, m.duplicate));
        addField.current?.focus();
      },
    });
  }

  function confirmDelete() {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => {
        focusAddOnClose.current = true;
        setTarget(null);
        announce(m.deleted);
      },
      onError: (err) => {
        // 404: já foi apagado noutro lado; a lista é atualizada e o diálogo fecha
        if (isApiError(err, 'not_found')) {
          focusAddOnClose.current = true;
          setTarget(null);
          void query.refetch();
        }
        setDeleteError(errorMessage(err, m.duplicate));
      },
    });
  }

  return (
    <SectionFrame
      idPrefix={kind}
      number={m.number}
      title={m.title}
      hint={m.hint}
      loading={query.isPending}
      failed={query.isError}
      onRetry={() => void query.refetch()}
    >
      {items.length === 0 ? (
        <div className="mb-5 rounded-[10px] bg-surface-2 px-4 py-3">
          <p className="font-medium">{m.empty}</p>
          <p className="mt-0.5 text-[13px] text-ink-2">{m.emptyHint}</p>
        </div>
      ) : (
        <ul aria-label={m.list} className="mb-5 border-b border-line">
          {items.map((item) => (
            <NamedRow
              key={item.id}
              kind={kind}
              item={item}
              m={m}
              announce={announce}
              onDelete={(it) => {
                setDeleteError(null);
                setTarget(it);
              }}
            />
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
        <TextField
          ref={addField}
          label={m.nameLabel}
          className="min-w-0 flex-1 basis-56"
          value={name}
          {...(addError ? { error: addError } : {})}
          autoComplete="off"
          maxLength={200}
          onChange={(e) => {
            setName(e.target.value);
            setAddError(null);
          }}
        />
        <Button type="submit" icon={Plus} disabled={create.isPending} className="mt-[26px]">
          {m.addButton}
        </Button>
      </form>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={fill(m.deleteTitle, { name: target?.name ?? '' })}
        description={m.deleteBody}
        onCloseAutoFocus={(e) => {
          if (focusAddOnClose.current) {
            focusAddOnClose.current = false;
            e.preventDefault();
            addField.current?.focus();
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

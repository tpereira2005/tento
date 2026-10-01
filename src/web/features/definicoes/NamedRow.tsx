import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type SyntheticEvent, type KeyboardEvent } from 'react';
import { t } from '../../i18n';
import { Button, TextField } from '../../ui';
import { useRenameNamed } from './api';
import { errorMessage, fill, isValidName } from './helpers';

export interface NamedItem {
  id: string;
  name: string;
}

export type NamedMessages = ReturnType<typeof t>['settings']['bookmakers'];

interface NamedRowProps {
  kind: 'bookmakers' | 'profiles';
  item: NamedItem;
  m: NamedMessages;
  announce: (message: string) => void;
  onDelete: (item: NamedItem) => void;
}

/** Linha de casa/perfil: nome, renomear inline (Enter guarda, Escape cancela) e apagar. */
export function NamedRow({ kind, item, m, announce, onDelete }: NamedRowProps) {
  const s = t().settings;
  const rename = useRenameNamed(kind);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  // ao abrir a edição o foco vai para o campo
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  // depois de sair da edição, o foco volta ao botão de renomear
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function startEdit() {
    setDraft(item.name);
    setError(null);
    setEditing(true);
  }

  function stopEdit() {
    restoreFocus.current = true;
    setError(null);
    setEditing(false);
  }

  function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!isValidName(draft)) {
      setError(s.errors.invalidName);
      return;
    }
    if (draft.trim() === item.name) {
      stopEdit();
      return;
    }
    rename.mutate(
      { id: item.id, name: draft.trim() },
      {
        onSuccess: () => {
          stopEdit();
          announce(m.renamed);
        },
        onError: (err) => {
          setError(errorMessage(err, m.duplicate));
        },
      },
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopEdit();
    }
  }

  if (editing) {
    return (
      <li className="border-t border-line py-3">
        <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
          <TextField
            label={fill(s.rename, { name: item.name })}
            hideLabel
            className="min-w-0 flex-1"
            value={draft}
            {...(error ? { error } : {})}
            ref={input}
            autoComplete="off"
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
          />
          <Button type="submit" size="md" disabled={rename.isPending}>
            {s.save}
          </Button>
          <Button variant="secondary" onClick={stopEdit}>
            {s.cancel}
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-t border-line py-2">
      <span className="min-w-0 break-words font-medium">{item.name}</span>
      <span className="flex shrink-0 gap-1">
        <Button
          ref={editButton}
          variant="quiet"
          icon={Pencil}
          aria-label={fill(s.rename, { name: item.name })}
          onClick={startEdit}
        />
        <Button
          variant="quiet"
          icon={Trash2}
          aria-label={fill(s.remove, { name: item.name })}
          onClick={() => {
            onDelete(item);
          }}
        />
      </span>
    </li>
  );
}

import { Link } from '@tanstack/react-router';
import { LogOut, Settings } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../i18n';
import { useSignOut } from './useSignOut';

interface UserMenuProps {
  name: string;
  email: string;
}

/** Avatar com a inicial; abre um painel com o nome, o email, as Definições e "Terminar sessão". */
export function UserMenu({ name, email }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { signOut, pending } = useSignOut();
  const n = t();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (name.trim()[0] ?? email[0] ?? '?').toUpperCase();

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={n.shell.userMenu.replace('{name}', name)}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="grid size-10 place-items-center rounded-full bg-pos-tint font-display text-[18px] text-pos"
      >
        <span aria-hidden="true">{initial}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute top-12 right-0 z-40 w-64 max-w-[calc(100vw-32px)] rounded-[14px] border border-line bg-surface p-2"
        >
          <div className="px-3 py-2">
            <p className="font-medium break-words">{name}</p>
            <p className="text-[13px] break-all text-ink-2">{email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <Link
            to="/definicoes"
            onClick={() => {
              setOpen(false);
            }}
            className="flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 hover:bg-surface-2"
          >
            <Settings size={16} strokeWidth={1.8} aria-hidden="true" />
            {n.nav.settings}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left hover:bg-surface-2 disabled:opacity-50"
          >
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
            {n.shell.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

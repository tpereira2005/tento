import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '../../api/client';
import { t } from '../../i18n';
import { Button, Dialog, PasswordField, TextField } from '../../ui';
import { downloadExport, useDeleteAccount, useDeleteAllData } from './api';
import { fill } from './helpers';
import { SectionFrame } from './SectionFrame';

interface Props {
  announce: (message: string) => void;
}

/** Depois de apagar a conta a sessão já não existe: recomeça na entrada, sem estado em memória. */
function goToSignIn() {
  window.location.assign('/entrar');
}

const ROW = 'flex flex-wrap items-center justify-between gap-3 border-t border-line py-4 first:border-t-0';

/** Exportar todos os dados, apagá-los (mantendo a conta) ou apagar a própria conta. */
export function DataSection({ announce }: Props) {
  const s = t().settings;
  const m = s.data;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const deleteData = useDeleteAllData();
  const [dataOpen, setDataOpen] = useState(false);
  const [word, setWord] = useState('');
  const [dataError, setDataError] = useState(false);

  const deleteAccount = useDeleteAccount();
  const [accountOpen, setAccountOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [accountError, setAccountError] = useState<string | null>(null);

  async function runExport() {
    setExporting(true);
    setExportError(false);
    try {
      await downloadExport();
      announce(m.export.done);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function confirmDeleteData() {
    setDataError(false);
    deleteData.mutate(m.confirmWord, {
      onSuccess: () => {
        setDataOpen(false);
        announce(m.deleteData.done);
      },
      onError: () => {
        setDataError(true);
      },
    });
  }

  function confirmDeleteAccount() {
    if (password === '') {
      setAccountError(m.deleteAccount.passwordRequired);
      return;
    }
    setAccountError(null);
    deleteAccount.mutate(password, {
      onSuccess: goToSignIn,
      onError: (err) => {
        setAccountError(
          isApiError(err, 'invalid_password') ? m.deleteAccount.wrongPassword : m.deleteAccount.error,
        );
      },
    });
  }

  return (
    <SectionFrame idPrefix="dados" number={m.number} title={m.title} hint={m.hint}>
      <ul className="-my-4 list-none p-0">
        <li className={ROW}>
          <div className="max-w-md">
            <h3 className="font-medium">{m.export.title}</h3>
            <p className="text-[13px] text-ink-2">{m.export.body}</p>
            {exportError ? (
              <p role="alert" className="mt-1 text-[13px] font-medium text-neg-text">
                {m.export.error}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" icon={Download} disabled={exporting} onClick={() => void runExport()}>
            {exporting ? m.export.pending : m.export.button}
          </Button>
        </li>

        <li className={ROW}>
          <div className="max-w-md">
            <h3 className="font-medium">{m.deleteData.title}</h3>
            <p className="text-[13px] text-ink-2">{m.deleteData.body}</p>
          </div>
          <Dialog
            open={dataOpen}
            onOpenChange={(open) => {
              setDataOpen(open);
              if (!open) {
                setWord('');
                setDataError(false);
              }
            }}
            title={m.deleteData.dialogTitle}
            description={m.deleteData.dialogBody}
            trigger={
              <Button variant="secondary" icon={Trash2}>
                {m.deleteData.button}
              </Button>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (word === m.confirmWord) confirmDeleteData();
              }}
            >
              <TextField
                label={fill(m.deleteData.label, { word: m.confirmWord })}
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {dataError ? (
                <p role="alert" className="mt-3 text-[13px] font-medium text-neg-text">
                  {m.deleteData.error}
                </p>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDataOpen(false);
                  }}
                >
                  {s.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={word !== m.confirmWord || deleteData.isPending}
                >
                  {deleteData.isPending ? m.deleteData.pending : m.deleteData.confirm}
                </Button>
              </div>
            </form>
          </Dialog>
        </li>

        <li className={ROW}>
          <div className="max-w-md">
            <h3 className="font-medium">{m.deleteAccount.title}</h3>
            <p className="text-[13px] text-ink-2">{m.deleteAccount.body}</p>
          </div>
          <Dialog
            open={accountOpen}
            onOpenChange={(open) => {
              setAccountOpen(open);
              if (!open) {
                setPassword('');
                setAccountError(null);
              }
            }}
            title={m.deleteAccount.dialogTitle}
            description={m.deleteAccount.dialogBody}
            trigger={
              <Button variant="secondary" icon={Trash2}>
                {m.deleteAccount.button}
              </Button>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmDeleteAccount();
              }}
            >
              <PasswordField
                label={m.deleteAccount.passwordLabel}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAccountError(null);
                }}
                autoComplete="current-password"
                error={accountError ?? undefined}
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAccountOpen(false);
                  }}
                >
                  {s.cancel}
                </Button>
                <Button type="submit" variant="danger" disabled={deleteAccount.isPending}>
                  {deleteAccount.isPending ? m.deleteAccount.pending : m.deleteAccount.confirm}
                </Button>
              </div>
            </form>
          </Dialog>
        </li>
      </ul>
    </SectionFrame>
  );
}

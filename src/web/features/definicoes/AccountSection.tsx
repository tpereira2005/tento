import { useState } from 'react';
import type { SettingsDto } from '../../api/types';
import { t } from '../../i18n';
import { Segmented } from '../../ui';
import { applyPreference } from '../../theme';
import { useMe, useUpdateSettings } from './api';
import { errorMessage } from './helpers';
import { SectionFrame } from './SectionFrame';

interface Props {
  announce: (message: string) => void;
}

/** Nome e email (só leitura), preferência de tema e nota de privacidade. */
export function AccountSection({ announce }: Props) {
  const m = t().settings.account;
  const me = useMe();
  const update = useUpdateSettings();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SettingsDto['theme'] | null>(null);

  const saved = me.data?.settings.theme ?? 'system';
  const current = pending ?? saved;

  function choose(next: string) {
    const theme = next as SettingsDto['theme'];
    const previous = current;
    setPending(theme);
    setError(null);
    applyPreference(theme);
    update.mutate(
      { theme },
      {
        onSuccess: () => {
          setPending(null);
          announce(m.themeSaved);
        },
        onError: (err) => {
          setPending(null);
          applyPreference(previous);
          setError(errorMessage(err, ''));
        },
      },
    );
  }

  return (
    <SectionFrame
      idPrefix="conta"
      number={m.number}
      title={m.title}
      loading={me.isPending}
      failed={me.isError}
      onRetry={() => void me.refetch()}
    >
      {me.data ? (
        <>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="eyebrow">{m.nameLabel}</dt>
              <dd className="mt-1 break-words font-medium">{me.data.user.name}</dd>
            </div>
            <div>
              <dt className="eyebrow">{m.emailLabel}</dt>
              <dd className="num mt-1 break-all text-[14px]">{me.data.user.email}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col items-start gap-2">
            <span id="tema-rotulo" className="text-[13px] font-medium">
              {m.themeLabel}
            </span>
            <Segmented
              aria-label={m.themeLabel}
              value={current}
              onValueChange={choose}
              options={[
                { value: 'system', label: m.themeSystem },
                { value: 'light', label: m.themeLight },
                { value: 'dark', label: m.themeDark },
              ]}
            />
            <p className="text-[12px] text-ink-2">{m.themeHint}</p>
            {error ? (
              <p role="alert" className="text-[13px] font-medium text-neg-text">
                {error}
              </p>
            ) : null}
          </div>

          <p className="mt-6 border-t border-line pt-4 text-[13px] text-ink-2">{m.privacy}</p>
        </>
      ) : null}
    </SectionFrame>
  );
}

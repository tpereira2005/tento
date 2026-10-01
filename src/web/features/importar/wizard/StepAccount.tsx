import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import type { WalletDto } from '../../../api/types';
import { t } from '../../../i18n';
import { Button, Select, Skeleton } from '../../../ui';
import { SEP } from '../../definicoes/helpers';
import { StepFrame } from './StepFrame';

export const walletName = (w: Pick<WalletDto, 'profileName' | 'bookmakerName'>) =>
  `${w.profileName} ${SEP} ${w.bookmakerName}`;

interface Props {
  wallets: readonly WalletDto[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  walletId: string;
  onWalletChange: (id: string) => void;
  onNext: () => void;
}

/** Passo 1: escolher a conta (perfil × casa) a que o CSV pertence. */
export function StepAccount({ wallets, loading, failed, onRetry, walletId, onWalletChange, onNext }: Props) {
  const m = t().import.account;
  return (
    <StepFrame step="account" title={m.title} lead={m.lead}>
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-neg-text">{m.loadError}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {m.retry}
          </Button>
        </div>
      ) : loading ? (
        <Skeleton className="h-10 w-64" />
      ) : wallets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-surface-2 px-4 py-4">
          <span className="grid size-10 place-items-center rounded-full bg-pos-tint text-pos">
            <Landmark size={20} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="font-medium">{m.emptyTitle}</p>
          <p className="max-w-prose text-ink-2">{m.emptyBody}</p>
          <Link
            to="/definicoes"
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-cta px-4 text-[14px] font-semibold text-cta-ink hover:brightness-110"
          >
            {m.emptyAction}
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label={m.selectLabel}
            options={wallets.map((w) => ({ value: w.id, label: walletName(w) }))}
            value={walletId}
            onValueChange={onWalletChange}
          />
          <Button onClick={onNext}>{t().import.next}</Button>
        </div>
      )}
    </StepFrame>
  );
}

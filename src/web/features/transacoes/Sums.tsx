import type { Summary } from '../../../core';
import { t } from '../../i18n';
import { Amount } from '../../ui';

/** Depositado, levantado e resultado líquido do filtro (mesmos números do Painel). */
export function Sums({ summary, partial }: { summary: Summary | undefined; partial: boolean }) {
  const s = t().transactions.sums;
  const cell = 'flex min-w-0 flex-col gap-1 rounded-[14px] border border-line bg-surface px-4 py-3';
  return (
    <section aria-label={s.label} className="flex flex-col gap-2">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cell}>
          <dt className="eyebrow">{s.deposited}</dt>
          <dd className="font-display text-[26px] leading-none font-light">
            {summary ? <Amount cents={summary.depositedCents} tone="neutral" variant="display" /> : ' '}
          </dd>
        </div>
        <div className={cell}>
          <dt className="eyebrow">{s.withdrawn}</dt>
          <dd className="font-display text-[26px] leading-none font-light">
            {summary ? <Amount cents={summary.withdrawnCents} tone="neutral" variant="display" /> : ' '}
          </dd>
        </div>
        <div className={cell}>
          <dt className="eyebrow">{s.net}</dt>
          <dd className="font-display text-[26px] leading-none font-light">
            {summary ? <Amount cents={summary.netCents} signed withTriangle variant="display" /> : ' '}
          </dd>
        </div>
      </dl>
      {partial ? <p className="text-[12px] text-ink-2">{s.note}</p> : null}
    </section>
  );
}

import { Fragment, type ReactNode } from 'react';
import { addMonths, formatCents, formatPercent, type Insight, type MonthKey } from '../../../core';
import { t } from '../../i18n';
import { Amount } from '../../ui';
import { formatIsoDate } from '../definicoes/helpers';
import { capitalize, monthName, signedPercent } from './derive';

const num = (v: number | string | undefined): number => Number(v ?? 0);
const str = (v: number | string | undefined): string => String(v ?? '');
const month = (v: number | string | undefined): MonthKey => str(v) as MonthKey;

const money = (cents: number, signed = false): ReactNode => (
  <Amount cents={cents} signed={signed} tone={signed ? 'auto' : 'neutral'} />
);

/** Parte o texto em `{chave}` e troca cada uma pelo nó correspondente. */
export function renderTemplate(template: string, tokens: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in tokens ? <Fragment key={i}>{tokens[key]}</Fragment> : part;
  });
}

/** O texto de um destaque (pt-PT ou en, conforme o idioma ativo) ou `null` se o id for desconhecido. */
export function insightText(insight: Insight): ReactNode | null {
  const m = t().dashboard.insights;
  const p = insight.params;
  switch (insight.id) {
    case 'negative_streak':
      return renderTemplate(m.negative_streak, {
        months: num(p.months),
        startMonth: monthName(str(p.startMonth)),
      });
    case 'positive_streak':
      return renderTemplate(m.positive_streak, {
        months: num(p.months),
        startMonth: monthName(str(p.startMonth)),
      });
    case 'worst_month':
      return renderTemplate(m.worst_month, {
        Month: capitalize(monthName(str(p.month))),
        net: money(num(p.netCents), true),
      });
    case 'best_month':
      return renderTemplate(m.best_month, {
        Month: capitalize(monthName(str(p.month))),
        net: money(num(p.netCents), true),
      });
    case 'deposits_change_vs_prev_month':
      return renderTemplate(m.deposits_change_vs_prev_month, {
        deposited: money(num(p.depositedCents)),
        month: monthName(str(p.month)),
        ratio: <strong className="num font-semibold">{signedPercent(num(p.ratio))}</strong>,
        prevMonth: monthName(addMonths(month(p.month), -1)),
      });
    case 'last3_vs_prev3':
      return renderTemplate(m.last3_vs_prev3, {
        last3: money(num(p.last3NetCents), true),
        prev3: money(num(p.prev3NetCents), true),
      });
    case 'days_since_last_deposit':
      return renderTemplate(m.days_since_last_deposit, {
        days: num(p.days),
        date: <span className="num">{formatIsoDate(str(p.date))}</span>,
      });
    case 'withdrawn_ratio':
      return renderTemplate(m.withdrawn_ratio, {
        ratio: <strong className="num font-semibold">{formatPercent(num(p.ratio))}</strong>,
        withdrawn: <span className="num">{formatCents(num(p.withdrawnCents))}</span>,
        deposited: <span className="num">{formatCents(num(p.depositedCents))}</span>,
      });
    default:
      return null;
  }
}

import { Fragment, type ReactNode } from 'react';
import { addMonths, formatCents, formatPercent, type Insight, type MonthKey } from '../../../core';
import { t } from '../../i18n';
import { Amount } from '../../ui';
import { formatIsoDate } from '../definicoes/helpers';
import { capitalize, monthName, signedPercent } from './derive';

const num = (v: number | string | undefined): number => Number(v ?? 0);
const str = (v: number | string | undefined): string => String(v ?? '');
const month = (v: number | string | undefined): MonthKey => str(v) as MonthKey;

/** Como apresentar os valores de um destaque: com componentes (Painel) ou como texto simples (PDF). */
interface Formatter<T> {
  money: (cents: number, signed?: boolean) => T;
  strong: (text: string) => T;
  mono: (text: string) => T;
}

type Token<T> = T | string | number;

/** O modelo de texto (pt-PT ou en, conforme o idioma ativo) e os valores de cada `{chave}`. */
function insightParts<T>(
  insight: Insight,
  f: Formatter<T>,
): { template: string; tokens: Record<string, Token<T>> } | null {
  const m = t().dashboard.insights;
  const p = insight.params;
  switch (insight.id) {
    case 'negative_streak':
    case 'positive_streak':
      return {
        template: m[insight.id],
        tokens: { months: num(p.months), startMonth: monthName(str(p.startMonth)) },
      };
    case 'worst_month':
    case 'best_month':
      return {
        template: m[insight.id],
        tokens: { Month: capitalize(monthName(str(p.month))), net: f.money(num(p.netCents), true) },
      };
    case 'deposits_change_vs_prev_month':
      return {
        template: m.deposits_change_vs_prev_month,
        tokens: {
          deposited: f.money(num(p.depositedCents)),
          month: monthName(str(p.month)),
          ratio: f.strong(signedPercent(num(p.ratio))),
          prevMonth: monthName(addMonths(month(p.month), -1)),
        },
      };
    case 'last3_vs_prev3':
      return {
        template: m.last3_vs_prev3,
        tokens: { last3: f.money(num(p.last3NetCents), true), prev3: f.money(num(p.prev3NetCents), true) },
      };
    case 'days_since_last_deposit':
      return {
        template: m.days_since_last_deposit,
        tokens: { days: num(p.days), date: f.mono(formatIsoDate(str(p.date))) },
      };
    case 'withdrawn_ratio':
      return {
        template: m.withdrawn_ratio,
        tokens: {
          ratio: f.strong(formatPercent(num(p.ratio))),
          withdrawn: f.mono(formatCents(num(p.withdrawnCents))),
          deposited: f.mono(formatCents(num(p.depositedCents))),
        },
      };
    default:
      return null;
  }
}

const KEY = /(\{\w+\})/;

/** Parte o texto em `{chave}` e troca cada uma pelo nó correspondente. */
export function renderTemplate(template: string, tokens: Record<string, ReactNode>): ReactNode {
  return template.split(KEY).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in tokens ? <Fragment key={i}>{tokens[key]}</Fragment> : part;
  });
}

const reactFormatter: Formatter<ReactNode> = {
  money: (cents, signed = false) => (
    <Amount cents={cents} signed={signed} tone={signed ? 'auto' : 'neutral'} />
  ),
  strong: (text) => <strong className="num font-semibold">{text}</strong>,
  mono: (text) => <span className="num">{text}</span>,
};

const textFormatter: Formatter<string> = {
  money: (cents, signed = false) => formatCents(cents, { signed }),
  strong: (text) => text,
  mono: (text) => text,
};

/** O texto de um destaque com componentes (Painel), ou `null` se o id for desconhecido. */
export function insightText(insight: Insight): ReactNode | null {
  const parts = insightParts(insight, reactFormatter);
  return parts ? renderTemplate(parts.template, parts.tokens) : null;
}

/** O mesmo texto em texto simples (relatório PDF), ou `null` se o id for desconhecido. */
export function insightPlainText(insight: Insight): string | null {
  const parts = insightParts(insight, textFormatter);
  if (!parts) return null;
  return parts.template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in parts.tokens ? String(parts.tokens[key]) : whole,
  );
}

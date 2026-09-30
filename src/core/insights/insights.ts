import { computeStreaks, monthlySeries, summarize, type MonthBounds } from '../stats';
import type { IsoDate, MonthKey, Transaction, WalletRef } from '../types';

export type InsightTone = 'positive' | 'negative' | 'neutral';

/**
 * Um destaque: só dados. O texto é produzido na camada web, traduzindo `id` + `params` (i18n).
 * Quando um destaque é gerado, `priority` mais alta aparece primeiro; empates por `id`.
 */
export interface Insight {
  id: string;
  tone: InsightTone;
  priority: number;
  params: Record<string, number | string>;
}

export interface InsightContext {
  txns: readonly Transaction[];
  wallets: readonly WalletRef[];
  today: IsoDate;
  from?: MonthKey;
  to?: MonthKey;
}

export interface InsightOptions {
  /** Número máximo de destaques devolvidos (por omissão 3). */
  max?: number;
}

export const DEFAULT_MAX_INSIGHTS = 3;

/** Variação mínima (25 %) dos depósitos face ao mês anterior. */
export const DEPOSITS_CHANGE_THRESHOLD = 0.25;
/** Meses seguidos para haver destaque de sequência. */
export const MIN_STREAK_MONTHS = 3;
/** Dias sem depositar para haver destaque. */
export const MIN_DAYS_SINCE_DEPOSIT = 30;

/**
 * Gera os destaques, por ordem de `priority` decrescente e depois `id`. Todos os valores de dinheiro
 * em cêntimos; meses como `AAAA-MM`; `ratio` é uma razão (0,6349 = +63,49 %).
 *
 * | id                            | tone               | priority | params                                                   |
 * | ----------------------------- | ------------------ | -------- | -------------------------------------------------------- |
 * | `negative_streak`             | negative           | 85       | `months` (n.º de meses), `startMonth`                    |
 * | `worst_month`                 | negative           | 80       | `month`, `netCents` (último mês do intervalo é o pior)   |
 * | `deposits_change_vs_prev_month` | negative se subiu, positive se desceu | 75 | `month`, `depositedCents`, `prevDepositedCents`, `ratio` |
 * | `best_month`                  | positive           | 70       | `month`, `netCents` (último mês é o melhor)              |
 * | `positive_streak`             | positive           | 65       | `months`, `startMonth`                                   |
 * | `last3_vs_prev3`              | positive/negative/neutral (último trimestre melhor/pior/igual) | 60 | `last3NetCents`, `prev3NetCents` |
 * | `days_since_last_deposit`     | positive           | 50       | `days`, `date` (último depósito)                         |
 * | `withdrawn_ratio`             | neutral            | 10       | `ratio`, `depositedCents`, `withdrawnCents`              |
 *
 * Condições: `worst_month`/`best_month` precisam de ≥ 2 meses e de resultado < 0 / > 0 nesse mês (empates
 * não contam); `deposits_change_vs_prev_month` precisa de mês anterior com depósitos > 0 e |Δ| ≥ 25 %;
 * `last3_vs_prev3` precisa de ≥ 6 meses; sequências atuais com ≥ 3 meses; `days_since_last_deposit` com ≥ 30
 * dias; `withdrawn_ratio` quando há depósitos.
 */
export function generateInsights(ctx: InsightContext, options: InsightOptions = {}): Insight[] {
  const max = options.max ?? DEFAULT_MAX_INSIGHTS;
  const bounds: MonthBounds = {
    ...(ctx.from !== undefined ? { from: ctx.from } : {}),
    ...(ctx.to !== undefined ? { to: ctx.to } : {}),
  };
  const series = monthlySeries(ctx.txns, bounds);
  const summary = summarize(ctx.txns, { today: ctx.today, ...bounds });
  const streaks = computeStreaks(ctx.txns, bounds);
  const out: Insight[] = [];

  const lastPoint = series[series.length - 1];
  if (lastPoint && series.length >= 2) {
    if (summary.worstMonth?.month === lastPoint.month && lastPoint.netCents < 0) {
      out.push({
        id: 'worst_month',
        tone: 'negative',
        priority: 80,
        params: { month: lastPoint.month, netCents: lastPoint.netCents },
      });
    }
    if (summary.bestMonth?.month === lastPoint.month && lastPoint.netCents > 0) {
      out.push({
        id: 'best_month',
        tone: 'positive',
        priority: 70,
        params: { month: lastPoint.month, netCents: lastPoint.netCents },
      });
    }
    const prev = series[series.length - 2];
    if (prev && prev.depositedCents > 0) {
      const ratio = (lastPoint.depositedCents - prev.depositedCents) / prev.depositedCents;
      if (Math.abs(ratio) >= DEPOSITS_CHANGE_THRESHOLD) {
        out.push({
          id: 'deposits_change_vs_prev_month',
          tone: ratio > 0 ? 'negative' : 'positive',
          priority: 75,
          params: {
            month: lastPoint.month,
            depositedCents: lastPoint.depositedCents,
            prevDepositedCents: prev.depositedCents,
            ratio,
          },
        });
      }
    }
  }

  if (series.length >= 6) {
    const sum = (pts: typeof series) => pts.reduce((acc, p) => acc + p.netCents, 0);
    const last3NetCents = sum(series.slice(-3));
    const prev3NetCents = sum(series.slice(-6, -3));
    out.push({
      id: 'last3_vs_prev3',
      tone:
        last3NetCents > prev3NetCents ? 'positive' : last3NetCents < prev3NetCents ? 'negative' : 'neutral',
      priority: 60,
      params: { last3NetCents, prev3NetCents },
    });
  }

  const current = streaks.current;
  if (current && current.length >= MIN_STREAK_MONTHS && current.sign !== 'zero') {
    const positive = current.sign === 'positive';
    out.push({
      id: positive ? 'positive_streak' : 'negative_streak',
      tone: positive ? 'positive' : 'negative',
      priority: positive ? 65 : 85,
      params: { months: current.length, startMonth: current.start },
    });
  }

  if (summary.lastDeposit && summary.daysSinceLastDeposit !== null) {
    const days = summary.daysSinceLastDeposit;
    if (days >= MIN_DAYS_SINCE_DEPOSIT) {
      out.push({
        id: 'days_since_last_deposit',
        tone: 'positive',
        priority: 50,
        params: { days, date: summary.lastDeposit.date },
      });
    }
  }

  if (summary.withdrawnRatio !== null) {
    out.push({
      id: 'withdrawn_ratio',
      tone: 'neutral',
      priority: 10,
      params: {
        ratio: summary.withdrawnRatio,
        depositedCents: summary.depositedCents,
        withdrawnCents: summary.withdrawnCents,
      },
    });
  }

  out.sort((a, b) => b.priority - a.priority || Number(a.id > b.id) - Number(a.id < b.id));
  return out.slice(0, Math.max(0, max));
}

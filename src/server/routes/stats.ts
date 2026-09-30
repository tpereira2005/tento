import { Hono } from 'hono';
import {
  addMonths,
  breakdown,
  computeStreaks,
  depositHeatmap,
  filterTransactions,
  firstDayOfMonth,
  generateInsights,
  isoDateFromEpochMs,
  monthOf,
  monthlySeries,
  summarize,
  type MonthBounds,
} from '../../core';
import { listTransactions, walletRefs } from '../db/repos';
import { validate, type AppEnv } from '../http';
import { filterQuery, toFilter } from './filters';

export function statsRoutes(now: () => Date) {
  const app = new Hono<AppEnv>();

  app.get('/dashboard', validate('query', filterQuery), async (c) => {
    const db = c.get('db');
    const userId = c.get('user').id;
    const query = c.req.valid('query');
    const today = isoDateFromEpochMs(now().getTime());

    const [all, wallets] = await Promise.all([listTransactions(db, userId), walletRefs(db, userId)]);
    const txns = filterTransactions(all, wallets, toFilter(query));

    const bounds: MonthBounds = {
      ...(query.from ? { from: monthOf(query.from) } : {}),
      ...(query.to ? { to: monthOf(query.to) } : {}),
    };

    // Mapa de calor: o intervalo do filtro ou os últimos 12 meses até hoje.
    const heatTo = query.to ?? today;
    const heatFrom = query.from ?? firstDayOfMonth(addMonths(monthOf(heatTo), -11));

    return c.json({
      summary: summarize(txns, { today, ...bounds }),
      monthly: monthlySeries(txns, bounds),
      streaks: computeStreaks(txns, bounds),
      heatmap: depositHeatmap(txns, { from: heatFrom, to: heatTo }),
      breakdown: {
        wallet: breakdown(txns, wallets, 'wallet'),
        profile: breakdown(txns, wallets, 'profile'),
        bookmaker: breakdown(txns, wallets, 'bookmaker'),
      },
      insights: generateInsights({ txns, wallets, today, ...bounds }),
    });
  });

  return app;
}

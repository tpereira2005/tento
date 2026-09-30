import { Hono } from 'hono';
import { z } from 'zod';
import { createManualTransaction, deleteTransaction, pageTransactions, updateTransaction } from '../db/repos';
import { compact, failure, notFound, validate, type AppEnv } from '../http';
import { filterQuery, isoDateSchema, toFilter } from './filters';

const listQuery = filterQuery.extend({
  type: z.enum(['deposit', 'withdrawal']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).max(200).optional(),
});

const amount = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const note = z.string().trim().max(500);

const createBody = z.object({
  walletId: z.string().min(1).max(64),
  date: isoDateSchema,
  type: z.enum(['deposit', 'withdrawal']),
  amountCents: amount,
  note: note.optional(),
});

const patchBody = z
  .object({
    date: isoDateSchema.optional(),
    type: z.enum(['deposit', 'withdrawal']).optional(),
    amountCents: amount.optional(),
    note: note.nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Indica pelo menos um campo.');

const idParam = z.object({ id: z.string().min(1).max(64) });

export function transactionRoutes() {
  const app = new Hono<AppEnv>();

  app.get('/', validate('query', listQuery), async (c) => {
    const { q, type, limit, cursor, ...rest } = c.req.valid('query');
    const page = await pageTransactions(c.get('db'), c.get('user').id, {
      filter: toFilter(rest),
      limit,
      ...compact({ type, search: q === '' ? undefined : q, cursor }),
    });
    return c.json(page);
  });

  app.post('/', validate('json', createBody), async (c) => {
    const { note: n, ...body } = c.req.valid('json');
    const r = await createManualTransaction(c.get('db'), c.get('user').id, {
      ...body,
      ...(n !== undefined ? { note: n } : {}),
    });
    return r.ok ? c.json(r.value, 201) : failure(r.error);
  });

  app.patch('/:id', validate('param', idParam), validate('json', patchBody), async (c) => {
    const r = await updateTransaction(
      c.get('db'),
      c.get('user').id,
      c.req.valid('param').id,
      compact(c.req.valid('json')),
    );
    return r.ok ? c.json(r.value) : failure(r.error);
  });

  app.delete('/:id', validate('param', idParam), async (c) => {
    const done = await deleteTransaction(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return done ? c.body(null, 204) : notFound();
  });

  return app;
}

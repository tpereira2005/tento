import { isIsoDate, type TransactionFilter } from '../../core';
import { z } from 'zod';

/** Lista separada por vírgulas (`a,b,c`) → `string[]`; vazio → `undefined`. */
const commaList = z
  .string()
  .max(2000)
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x !== ''),
  )
  .pipe(z.array(z.string().max(64)).max(100))
  .transform((l) => (l.length > 0 ? l : undefined));

export const isoDateSchema = z.string().refine(isIsoDate, 'Data inválida (AAAA-MM-DD)');

export const filterQuery = z.object({
  walletIds: commaList.optional(),
  profileIds: commaList.optional(),
  bookmakerIds: commaList.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type FilterQuery = z.infer<typeof filterQuery>;

/** Filtro do domínio a partir dos parâmetros da query (sem chaves `undefined`). */
export function toFilter(q: FilterQuery): TransactionFilter {
  const out: TransactionFilter = {};
  if (q.walletIds) out.walletIds = q.walletIds;
  if (q.profileIds) out.profileIds = q.profileIds;
  if (q.bookmakerIds) out.bookmakerIds = q.bookmakerIds;
  if (q.from) out.from = q.from;
  if (q.to) out.to = q.to;
  return out;
}

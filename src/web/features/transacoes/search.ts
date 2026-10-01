import { z } from 'zod';
import { isIsoDate, type IsoDate } from '../../../core';
import { ALL_BOOKMAKERS, ALL_PROFILES, PERIODS, periodRange, type Period } from '../painel/search';

export const ALL_ACCOUNTS = 'todas';
export const ALL_TYPES = 'todos';
export const TYPES = [ALL_TYPES, 'deposit', 'withdrawal'] as const;
export const DEFAULT_PERIOD: Period = 'tudo';
export const SEARCH_MAX = 100;

const idParam = z.string().min(1).max(64).optional().catch(undefined);
const dateParam = z
  .string()
  .refine((s): boolean => isIsoDate(s))
  .optional()
  .catch(undefined);
/** O router converte `?q=123` em número; aceita-se e volta a texto. */
const textParam = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().max(SEARCH_MAX))
  .optional()
  .catch(undefined);

/**
 * Filtros das transações no URL: `?perfil=…&casa=…&conta=…&tipo=deposit|withdrawal&periodo=3m|6m|12m|tudo
 * &de=AAAA-MM-DD&ate=AAAA-MM-DD&q=…`. Valores inválidos são ignorados; `de`/`ate` têm prioridade sobre `periodo`.
 */
export const transactionsSearch = z.object({
  perfil: idParam,
  casa: idParam,
  conta: idParam,
  tipo: z.enum(TYPES).optional().catch(undefined),
  periodo: z.enum(PERIODS).optional().catch(undefined),
  de: dateParam,
  ate: dateParam,
  q: textParam,
});

export type TransactionsSearch = z.infer<typeof transactionsSearch>;

/** Para `validateSearch` do router. */
export function parseTransactionsSearch(raw: Record<string, unknown>): TransactionsSearch {
  return transactionsSearch.parse(raw);
}

export interface TxnFilters {
  profileId?: string;
  bookmakerId?: string;
  walletId?: string;
  type?: 'deposit' | 'withdrawal';
  from?: IsoDate;
  to?: IsoDate;
  q?: string;
}

export function hasCustomRange(search: TransactionsSearch): boolean {
  return search.de !== undefined || search.ate !== undefined;
}

/** Filtros efetivos: intervalo explícito (`de`/`ate`) ou o do período. */
export function resolveFilters(search: TransactionsSearch, today: IsoDate): TxnFilters {
  const out: TxnFilters = {};
  if (search.perfil && search.perfil !== ALL_PROFILES) out.profileId = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.bookmakerId = search.casa;
  if (search.conta && search.conta !== ALL_ACCOUNTS) out.walletId = search.conta;
  if (search.tipo && search.tipo !== ALL_TYPES) out.type = search.tipo;
  const range = hasCustomRange(search)
    ? { from: search.de as IsoDate | undefined, to: search.ate as IsoDate | undefined }
    : periodRange(search.periodo ?? DEFAULT_PERIOD, today);
  if (range.from) out.from = range.from;
  if (range.to) out.to = range.to;
  if (search.q) out.q = search.q;
  return out;
}

/** Procura no URL sem os valores por omissão, para o endereço ficar limpo. */
export function cleanSearch(search: TransactionsSearch): TransactionsSearch {
  const out: TransactionsSearch = {};
  if (search.perfil && search.perfil !== ALL_PROFILES) out.perfil = search.perfil;
  if (search.casa && search.casa !== ALL_BOOKMAKERS) out.casa = search.casa;
  if (search.conta && search.conta !== ALL_ACCOUNTS) out.conta = search.conta;
  if (search.tipo && search.tipo !== ALL_TYPES) out.tipo = search.tipo;
  if (hasCustomRange(search)) {
    if (search.de) out.de = search.de;
    if (search.ate) out.ate = search.ate;
  } else if (search.periodo && search.periodo !== DEFAULT_PERIOD) {
    out.periodo = search.periodo;
  }
  if (search.q) out.q = search.q;
  return out;
}

export function hasActiveFilters(search: TransactionsSearch): boolean {
  return Object.keys(cleanSearch(search)).length > 0;
}

/** Parâmetros de `GET /api/transactions`. */
export function listParams(f: TxnFilters): Record<string, string | undefined> {
  return {
    profileIds: f.profileId,
    bookmakerIds: f.bookmakerId,
    walletIds: f.walletId,
    from: f.from,
    to: f.to,
    type: f.type,
    q: f.q,
  };
}

/** Parâmetros de `GET /api/stats/dashboard`: o servidor não filtra por tipo nem por nota. */
export function statsParams(f: TxnFilters): Record<string, string | undefined> {
  return {
    profileIds: f.profileId,
    bookmakerIds: f.bookmakerId,
    walletIds: f.walletId,
    from: f.from,
    to: f.to,
  };
}

import { z } from 'zod';
import {
  previousMonthsPeriod,
  samePeriodLastYear,
  type IsoDate,
  type Period as DateRange,
} from '../../../core';
import { DEFAULT_PERIOD, PERIODS, periodRange, type Period } from '../painel/search';

export const MODES = ['perfis', 'casas', 'periodos'] as const;
export type Mode = (typeof MODES)[number];

/** Períodos que se podem comparar com o anterior (`tudo` não tem anterior). */
export const PRESETS = ['3m', '6m', '12m'] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = '12m';

export const AGAINST = ['anterior', 'ano'] as const;
export type Against = (typeof AGAINST)[number];
export const DEFAULT_AGAINST: Against = 'anterior';

const id = z.string().min(1).max(64).optional().catch(undefined);

/**
 * Comparar no URL: `?modo=perfis|casas|periodos&a=…&b=…&periodo=3m|6m|12m|tudo`.
 * `a` e `b` são ids de perfis ou de casas; no modo períodos, `a` é o período (3m|6m|12m) e `b` é
 * `anterior` ou `ano`. Valores inválidos são ignorados.
 */
export const compareSearch = z.object({
  modo: z.enum(MODES).optional().catch(undefined),
  a: id,
  b: id,
  periodo: z.enum(PERIODS).optional().catch(undefined),
});

export type CompareSearch = z.infer<typeof compareSearch>;

export function parseCompareSearch(raw: Record<string, unknown>): CompareSearch {
  return compareSearch.parse(raw);
}

/** Procura sem os valores por omissão, para o endereço ficar limpo. */
export function cleanSearch(search: CompareSearch): CompareSearch {
  const out: CompareSearch = {};
  if (search.modo) out.modo = search.modo;
  if (search.a) out.a = search.a;
  if (search.b) out.b = search.b;
  if (search.periodo && search.periodo !== DEFAULT_PERIOD) out.periodo = search.periodo;
  return out;
}

export interface Entity {
  id: string;
  name: string;
  /** Movimentos (soma das contas); decide quais são os dois por omissão. */
  activity: number;
}

/** Ids por ordem de atividade (mais movimentos primeiro; empates por nome). */
export function rankByActivity(items: readonly Entity[]): string[] {
  return [...items]
    .sort((x, y) => y.activity - x.activity || x.name.localeCompare(y.name, 'pt'))
    .map((x) => x.id);
}

/**
 * Os dois lados: o que vem no URL se existir e for diferente; senão os mais ativos.
 * `undefined` quando há menos de dois itens.
 */
export function resolvePair(
  items: readonly Entity[],
  wantedA: string | undefined,
  wantedB: string | undefined,
): [string, string] | undefined {
  if (items.length < 2) return undefined;
  const known = new Set(items.map((x) => x.id));
  const ranked = rankByActivity(items);
  let a = wantedA !== undefined && known.has(wantedA) ? wantedA : undefined;
  let b = wantedB !== undefined && known.has(wantedB) && wantedB !== a ? wantedB : undefined;
  a ??= ranked.find((x) => x !== b);
  b ??= ranked.find((x) => x !== a);
  return a !== undefined && b !== undefined ? [a, b] : undefined;
}

/** Modo por omissão: perfis se há dois ou mais, senão casas, senão períodos. */
export function defaultMode(profileCount: number, bookmakerCount: number): Mode {
  if (profileCount >= 2) return 'perfis';
  if (bookmakerCount >= 2) return 'casas';
  return 'periodos';
}

export function asPreset(value: string | undefined): Preset {
  return (PRESETS as readonly string[]).includes(value ?? '') ? (value as Preset) : DEFAULT_PRESET;
}

export function asAgainst(value: string | undefined): Against {
  return (AGAINST as readonly string[]).includes(value ?? '') ? (value as Against) : DEFAULT_AGAINST;
}

/** Os dois períodos do modo períodos: o escolhido (até hoje) e o anterior, ou o mesmo do ano anterior. */
export function periodPair(preset: Preset, against: Against, today: IsoDate): [DateRange, DateRange] {
  const range = periodRange(preset, today);
  // `periodRange` só devolve datas para períodos que não são `tudo`.
  const a: DateRange = { from: range.from ?? today, to: range.to ?? today };
  return [a, against === 'ano' ? samePeriodLastYear(a) : previousMonthsPeriod(a)];
}

/** Parâmetros da API (`/stats/dashboard`) de um lado. */
export interface SideParams {
  profileIds?: string;
  bookmakerIds?: string;
  from?: IsoDate;
  to?: IsoDate;
}

export type { Period };

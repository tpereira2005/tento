import {
  fillMonths,
  monthlyAligned,
  type AlignedMonth,
  type MonthlyPoint,
  type Summary,
} from '../../../core';
import type { DashboardDto } from '../painel/api';
import { monthAbbr, monthLabel } from '../painel/derive';
import type { Mode } from './search';

export interface SideInput {
  name: string;
  data: DashboardDto;
}

export interface SideModel {
  name: string;
  summary: Summary;
  /** Sem depósitos nem levantamentos neste lado. */
  empty: boolean;
  monthly: MonthlyPoint[];
}

export interface CompareModel {
  a: SideModel;
  b: SideModel;
  /** Séries mensais alinhadas por posição (mesmo comprimento nos dois lados). */
  aligned: AlignedMonth[];
  /** Os dois lados cobrem os mesmos meses de calendário (perfis e casas) ou não (períodos). */
  sameCalendar: boolean;
  /** Os dois lados estão sem movimentos. */
  bothEmpty: boolean;
}

const isEmpty = (s: Summary) => s.depositCount + s.withdrawalCount === 0;

/**
 * Perfis e casas partilham o mesmo período, mas com "tudo" cada lado começa no seu primeiro movimento:
 * preenchem-se os dois com os mesmos meses de calendário para a posição coincidir com o mês.
 */
function commonCalendar(
  a: readonly MonthlyPoint[],
  b: readonly MonthlyPoint[],
): [MonthlyPoint[], MonthlyPoint[]] {
  const months = [...a, ...b].map((p) => p.month).sort();
  const from = months[0];
  const to = months[months.length - 1];
  if (from === undefined || to === undefined) return [[...a], [...b]];
  return [fillMonths(a, from, to), fillMonths(b, from, to)];
}

export function buildModel(mode: Mode, a: SideInput, b: SideInput): CompareModel {
  const [ma, mb] =
    mode === 'periodos' ? [a.data.monthly, b.data.monthly] : commonCalendar(a.data.monthly, b.data.monthly);
  const aligned = monthlyAligned(ma, mb);
  const side = (input: SideInput, monthly: MonthlyPoint[]): SideModel => ({
    name: input.name,
    summary: input.data.summary,
    empty: isEmpty(input.data.summary),
    monthly,
  });
  const sa = side(a, ma);
  const sb = side(b, mb);
  return {
    a: sa,
    b: sb,
    aligned,
    sameCalendar: mode !== 'periodos',
    bothEmpty: sa.empty && sb.empty,
  };
}

/** Rótulo curto do eixo de uma posição: o mês do lado A (ou do B, se o A não tem meses). */
export function axisLabel(m: AlignedMonth): string {
  const month = m.monthA ?? m.monthB;
  return month ? monthAbbr(month) : String(m.index + 1);
}

/** Primeira coluna da tabela: um mês, ou os dois ("nov 2025 / nov 2024") quando diferem. */
export function rowLabel(m: AlignedMonth): string {
  const a = m.monthA ? monthLabel(m.monthA) : null;
  const b = m.monthB ? monthLabel(m.monthB) : null;
  if (a && b) return a === b ? a : `${a} / ${b}`;
  return a ?? b ?? String(m.index + 1);
}

/** `nov 2025 – out 2026` a partir de dois meses (ou só um, se coincidem). */
export function spanLabel(from: string, to: string): string {
  const a = monthLabel(from.slice(0, 7));
  const b = monthLabel(to.slice(0, 7));
  return a === b ? a : `${a} – ${b}`;
}

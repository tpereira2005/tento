import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { formatCents } from '../../core/format';
import { t } from '../i18n';

export const FALLBACK_WIDTH = 640;
/** Abaixo desta largura os gráficos passam a modo compacto (rótulos alternados). */
export const NARROW_WIDTH = 400;
/** Largura mínima por mês para mostrar todos os rótulos do eixo. */
export const MIN_BAND = 22;

/**
 * Largura do contentor, acompanhada com ResizeObserver. Sem medição possível (jsdom, SSR) usa 640.
 */
export function useChartWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = (value: number) => {
      const next = Math.floor(value);
      if (next > 0) setWidth(next);
    };
    read(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) read(entry.contentRect.width);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width];
}

/** "AAAA-MM" → "out" (sem Date nem getters de locale). */
export function monthShort(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return t().charts.monthsShort[index] ?? month;
}

/** Marca do eixo: com sinal, sem decimais e sem €. */
export function formatTick(cents: number): string {
  return formatCents(cents, { signed: true, currency: false, decimals: 0 });
}

/** Rótulo direto numa barra: sem sinal "+0", sem decimais quando o valor é redondo. */
export function formatBarLabel(cents: number): string {
  return formatCents(cents, { signed: true, currency: false, decimals: cents % 100 === 0 ? 0 : 2 });
}

/** "AAAA-MM-DD" → "dd/mm/aaaa". */
export function formatIsoDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** Identificador seguro para `url(#…)` a partir de `useId`. */
export function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Índices cujos rótulos se mostram: todos, ou de dois em dois a acabar no último (modo compacto). */
export function labelIndices(count: number, compact: boolean): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    if (!compact || (count - 1 - i) % 2 === 0) out.add(i);
  }
  return out;
}

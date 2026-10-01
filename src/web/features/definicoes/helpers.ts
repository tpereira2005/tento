import { isApiError } from '../../api/client';
import { t } from '../../i18n';

/** Substitui `{chave}` no texto pelos valores indicados. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

export const NAME_MAX = 60;

/** Nome válido para a API: entre 1 e 60 caracteres depois de aparar. */
export function isValidName(raw: string): boolean {
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX;
}

/** Traduz um erro da API numa mensagem para mostrar junto ao campo. */
export function errorMessage(error: unknown, duplicate: string): string {
  const m = t().settings.errors;
  if (isApiError(error)) {
    if (error.status === 409) return duplicate;
    if (error.status === 422) return m.invalidName;
    if (error.status === 404) return m.notFound;
  }
  return m.generic;
}

/** `2026-03-14` → `14/03/2026`, sem passar por `new Date(texto)` (fusos horários). */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const SEP = '·';

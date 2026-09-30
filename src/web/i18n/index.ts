import { en } from './en';
import { ptPT, type Messages } from './pt-PT';

export type Locale = 'pt-PT' | 'en';

const catalogs: Record<Locale, Messages> = { 'pt-PT': ptPT, en };

let current: Locale = 'pt-PT';

export function setLocale(locale: Locale): void {
  current = locale;
  document.documentElement.lang = locale;
}

/** Textos do idioma ativo, com chaves tipadas: `t().nav.dashboard`. */
export function t(): Messages {
  return catalogs[current];
}

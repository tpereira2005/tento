import type { ImportBatchDto } from '../../../api/types';
import { SEP } from '../../definicoes/helpers';

/** Conta no formato `Ana · Casa A`. */
export const accountName = (b: Pick<ImportBatchDto, 'profileName' | 'bookmakerName'>) =>
  `${b.profileName} ${SEP} ${b.bookmakerName}`;

/** Data e hora locais (Lisboa) de um instante ISO, ex.: `14/03/2026, 10:30`. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

/** Só a data local (Lisboa), ex.: `14/03/2026`. */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

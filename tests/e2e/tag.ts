import { randomUUID } from 'node:crypto';

/** Sufixo curto e único por corrida, para os nomes criados nos testes não colidirem na BD partilhada. */
export function uniqueTag(): string {
  return randomUUID().replaceAll('-', '').slice(0, 6);
}

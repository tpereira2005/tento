/** Utilitários comuns aos repositórios. */

export const NAME_MAX_LENGTH = 60;

/** Nome aparado, com 1 a 60 caracteres; `null` se inválido. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH ? name : null;
}

/** `id` novo (UUID v4). */
export const newId = (): string => crypto.randomUUID();

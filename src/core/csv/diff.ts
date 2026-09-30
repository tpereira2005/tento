import type { Cents, IsoDate, TxnType } from '../types';

export interface DiffRow {
  date: IsoDate;
  type: TxnType;
  amountCents: Cents;
}

export interface DiffResult<T extends DiffRow, E extends DiffRow> {
  /** Linhas do ficheiro sem correspondência nem candidata a conflito. */
  toAdd: T[];
  /** Linhas do ficheiro que já existem (data, tipo e valor iguais). */
  duplicates: T[];
  /** Linhas já guardadas que o ficheiro não tem. */
  missingFromFile: E[];
  /** Mesma data e tipo mas valor diferente: provável edição de um valor. A decisão é da interface. */
  conflicts: { incoming: T; existing: E }[];
}

const fullKey = (r: DiffRow) => `${r.date}|${r.type}|${r.amountCents}`;
const looseKey = (r: DiffRow) => `${r.date}|${r.type}`;

function pushTo<V>(map: Map<string, V[]>, key: string, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Compara as linhas de um ficheiro com as já guardadas como multiconjuntos: dois depósitos iguais no mesmo
 * dia são duas linhas. O emparelhamento é determinístico (ordem do ficheiro e ordem das existentes).
 */
export function diffTransactions<T extends DiffRow, E extends DiffRow>(
  incoming: readonly T[],
  existing: readonly E[],
): DiffResult<T, E> {
  const existingByKey = new Map<string, number[]>();
  existing.forEach((row, i) => {
    pushTo(existingByKey, fullKey(row), i);
  });

  const used = new Set<number>();
  const duplicates: T[] = [];
  const unmatchedIncoming: T[] = [];
  for (const row of incoming) {
    const idx = existingByKey.get(fullKey(row))?.shift();
    if (idx === undefined) {
      unmatchedIncoming.push(row);
    } else {
      used.add(idx);
      duplicates.push(row);
    }
  }

  const freeByLooseKey = new Map<string, number[]>();
  existing.forEach((row, i) => {
    if (!used.has(i)) pushTo(freeByLooseKey, looseKey(row), i);
  });

  const toAdd: T[] = [];
  const conflicts: { incoming: T; existing: E }[] = [];
  for (const row of unmatchedIncoming) {
    const idx = freeByLooseKey.get(looseKey(row))?.shift();
    const match = idx === undefined ? undefined : existing[idx];
    if (idx !== undefined && match !== undefined) {
      used.add(idx);
      conflicts.push({ incoming: row, existing: match });
    } else {
      toAdd.push(row);
    }
  }

  const missingFromFile = existing.filter((_, i) => !used.has(i));
  return { toAdd, duplicates, missingFromFile, conflicts };
}

import { t } from '../../../i18n';
import { fill } from '../../definicoes/helpers';

/** O servidor recusa mais de 5 MB; recusamos já no browser. */
export const MAX_BYTES = 5 * 1024 * 1024;

export type FileProblem = 'type' | 'tooLarge' | 'empty' | 'unreadable';

export interface LoadedFile {
  name: string;
  size: number;
  text: string;
  /** O ficheiro não era UTF-8 válido e foi lido como Windows-1252. */
  fallback: boolean;
}

export type LoadResult = { ok: true; file: LoadedFile } | { ok: false; problem: FileProblem };

/** Verificações que não precisam de ler o ficheiro: extensão ou tipo, tamanho e vazio. */
export function checkFile(file: Pick<File, 'name' | 'type' | 'size'>): FileProblem | null {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  if (!isCsv) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_BYTES) return 'tooLarge';
  return null;
}

/**
 * UTF-8 primeiro (sem retirar o BOM, para o servidor o poder reportar); se aparecer U+FFFD, o ficheiro não
 * é UTF-8 e lê-se como Windows-1252 (Excel em português).
 */
export function decodeCsv(buffer: ArrayBuffer): { text: string; fallback: boolean } {
  const utf8 = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);
  if (!utf8.includes(String.fromCharCode(0xfffd))) return { text: utf8, fallback: false };
  return { text: new TextDecoder('windows-1252', { ignoreBOM: true }).decode(buffer), fallback: true };
}

function readBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('read'));
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function loadCsvFile(file: File): Promise<LoadResult> {
  const problem = checkFile(file);
  if (problem) return { ok: false, problem };
  try {
    const { text, fallback } = decodeCsv(await readBuffer(file));
    if (text.trim() === '') return { ok: false, problem: 'empty' };
    return { ok: true, file: { name: file.name, size: file.size, text, fallback } };
  } catch {
    return { ok: false, problem: 'unreadable' };
  }
}

/** `1 234 567` → "1,2 MB", em pt-PT, sem passar por `toLocaleString` com opções frágeis. */
export function formatBytes(bytes: number): string {
  const m = t().import.file;
  const decimal = (n: number) => n.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (bytes < 1024) return fill(m.sizeBytes, { n: bytes });
  if (bytes < 1024 * 1024) return fill(m.sizeKb, { n: decimal(bytes / 1024) });
  return fill(m.sizeMb, { n: decimal(bytes / (1024 * 1024)) });
}

import { readFileSync } from 'node:fs';

export interface PdfText {
  pages: number;
  /** Texto de cada página, com espaços normalizados (NBSP e U+202F viram espaço simples). */
  perPage: string[];
  /** Todo o texto, página a página. */
  text: string;
}

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);
const SPACES = new RegExp(`[${NBSP}${NNBSP}\\s]+`, 'g');

/** Texto esperado normalizado da mesma forma que o extraído do PDF. */
export function norm(text: string): string {
  return text.replace(SPACES, ' ').trim();
}

/** Texto de um PDF no contexto Node do teste, com a build "legacy" do pdfjs-dist. */
export async function readPdfText(path: string): Promise<PdfText> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = Uint8Array.from(readFileSync(path));
  const task = pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true });
  const doc = await task.promise;
  const perPage: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const parts = content.items.map((item) => ('str' in item ? item.str : ''));
    perPage.push(norm(parts.join(' ')));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, perPage, text: perPage.join('\n') };
}

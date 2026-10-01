import { createRequire } from 'node:module';
import type { FontSources } from './fonts';

/*
 * Apoio aos testes (Node): caminhos dos ficheiros WOFF no disco e extração de texto com o pdf.js.
 * Não entra no pacote da aplicação.
 */

const require = createRequire(import.meta.url);
const file = (pkg: string, name: string) => require.resolve(`@fontsource/${pkg}/files/${name}.woff`);

export function nodeFontSources(): FontSources {
  return {
    frauncesLight: file('fraunces', 'fraunces-latin-300-normal'),
    frauncesRegular: file('fraunces', 'fraunces-latin-400-normal'),
    frauncesLightItalic: file('fraunces', 'fraunces-latin-300-italic'),
    frauncesRegularItalic: file('fraunces', 'fraunces-latin-400-italic'),
    sansRegular: file('instrument-sans', 'instrument-sans-latin-400-normal'),
    sansMedium: file('instrument-sans', 'instrument-sans-latin-500-normal'),
    sansSemiBold: file('instrument-sans', 'instrument-sans-latin-600-normal'),
    monoRegular: file('dm-mono', 'dm-mono-latin-400-normal'),
    monoMedium: file('dm-mono', 'dm-mono-latin-500-normal'),
  };
}

/** Texto de cada página (itens do pdf.js unidos; quebra de linha onde o pdf.js a marca). */
export async function extractPdfPages(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : '');
    }
    pages.push(text);
  }
  await task.destroy();
  return pages;
}

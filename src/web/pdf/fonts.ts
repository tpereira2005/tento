import { FONT } from './theme';

/** Caminho ou URL de cada ficheiro WOFF estático (o react-pdf não lê fontes variáveis). */
export interface FontSources {
  frauncesLight: string;
  frauncesRegular: string;
  frauncesLightItalic: string;
  frauncesRegularItalic: string;
  sansRegular: string;
  sansMedium: string;
  sansSemiBold: string;
  monoRegular: string;
  monoMedium: string;
}

let registered: string | null = null;

/** Regista as famílias no react-pdf (uma vez por conjunto de fontes) e desliga a hifenização. */
export async function registerPdfFonts(sources: FontSources): Promise<void> {
  const key = JSON.stringify(sources);
  if (registered === key) return;
  const { Font } = await import('@react-pdf/renderer');
  Font.register({
    family: FONT.display,
    fonts: [
      { src: sources.frauncesLight, fontWeight: 300 },
      { src: sources.frauncesRegular, fontWeight: 400 },
      { src: sources.frauncesLightItalic, fontWeight: 300, fontStyle: 'italic' },
      { src: sources.frauncesRegularItalic, fontWeight: 400, fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: FONT.sans,
    fonts: [
      { src: sources.sansRegular, fontWeight: 400 },
      { src: sources.sansMedium, fontWeight: 500 },
      { src: sources.sansSemiBold, fontWeight: 600 },
    ],
  });
  Font.register({
    family: FONT.mono,
    fonts: [
      { src: sources.monoRegular, fontWeight: 400 },
      { src: sources.monoMedium, fontWeight: 500 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = key;
}

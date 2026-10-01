import frauncesLight from '@fontsource/fraunces/files/fraunces-latin-300-normal.woff?url';
import frauncesLightItalic from '@fontsource/fraunces/files/fraunces-latin-300-italic.woff?url';
import frauncesRegular from '@fontsource/fraunces/files/fraunces-latin-400-normal.woff?url';
import frauncesRegularItalic from '@fontsource/fraunces/files/fraunces-latin-400-italic.woff?url';
import sansRegular from '@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff?url';
import sansMedium from '@fontsource/instrument-sans/files/instrument-sans-latin-500-normal.woff?url';
import sansSemiBold from '@fontsource/instrument-sans/files/instrument-sans-latin-600-normal.woff?url';
import monoRegular from '@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff?url';
import monoMedium from '@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff?url';
import type { FontSources } from './fonts';

/** URLs das fontes no browser: o Vite copia os ficheiros para o build (carregado só ao exportar). */
export const fontUrls: FontSources = {
  frauncesLight,
  frauncesRegular,
  frauncesLightItalic,
  frauncesRegularItalic,
  sansRegular,
  sansMedium,
  sansSemiBold,
  monoRegular,
  monoMedium,
};

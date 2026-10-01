/*
 * Paleta clara da marca para o PDF (sempre clara, nunca escura). O PDF não pode usar variáveis CSS,
 * por isso os valores repetem os tokens de src/web/styles/app.css.
 */
export const PDF_COLORS = {
  paper: '#F4F1EA',
  surface: '#FBFAF6',
  line: '#D9D4C7',
  ink: '#17191F',
  ink2: '#4A4F5C',
  pos: '#2336C8',
  posTint: '#DDE1FA',
  neg: '#E0564A',
  negText: '#B0322A',
  negTint: '#F6E4E0',
} as const;

export const FONT = {
  display: 'Fraunces',
  sans: 'Instrument Sans',
  mono: 'DM Mono',
} as const;

/** A4 em pontos. */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  marginTop: 46,
  marginBottom: 70,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

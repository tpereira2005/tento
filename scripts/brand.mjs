// Gera os ficheiros da marca a partir da geometria do símbolo:
//   brand/*.svg, public/favicon.svg, public/*.png (ícones) e brand/logo-*.png (logótipo com o nome em Fraunces).
// Uso: pnpm brand
/* global document */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { chromium } from '@playwright/test';

const TOKEN =
  'M9 21a15 15 0 1 0 30 0a15 15 0 1 0 -30 0Z M14 21a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z M17 21a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z';
const C = { papel: '#F4F1EA', tinta: '#17191F', cobalto: '#2336C8', texto: '#F1EEE6', positivo: '#A9B6FF' };

const mark = (fill, rule) =>
  `<path d="${TOKEN}" fill-rule="evenodd" fill="${fill}"/><rect x="5" y="40" width="38" height="3.5" rx="1" fill="${rule}"/>`;

const markSvg = (fill, rule) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${mark(fill, rule)}</svg>\n`;

// Ícone: quadrado cobalto com o símbolo em papel. `radius` 0 para iOS (o sistema arredonda) e `scale` menor para ícones "maskable".
const iconSvg = ({ radius = 14.4, scale = 0.8333, bg = C.cobalto, fg = C.papel } = {}) => {
  const size = 48 * scale;
  const offset = (64 - size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${bg}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${mark(fg, fg)}</g></svg>\n`;
};

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

mkdirSync('brand', { recursive: true });
mkdirSync('public', { recursive: true });

writeFileSync('brand/mark.svg', markSvg(C.cobalto, C.tinta));
writeFileSync('brand/mark-dark.svg', markSvg(C.positivo, C.texto));
writeFileSync('brand/icon.svg', iconSvg());
writeFileSync('brand/icon-alt.svg', iconSvg({ bg: C.tinta, fg: C.positivo }));
writeFileSync('public/favicon.svg', iconSvg());
writeFileSync('public/favicon-32.png', png(iconSvg(), 32));
writeFileSync('public/apple-touch-icon.png', png(iconSvg({ radius: 0 }), 180));
writeFileSync('public/icon-192.png', png(iconSvg(), 192));
writeFileSync('public/icon-512.png', png(iconSvg(), 512));
writeFileSync('public/icon-maskable-512.png', png(iconSvg({ radius: 0, scale: 0.6 }), 512));
writeFileSync('brand/icon-512.png', png(iconSvg(), 512));

writeFileSync(
  'public/manifest.webmanifest',
  JSON.stringify(
    {
      name: 'Tento',
      short_name: 'Tento',
      description: 'O fluxo de caixa das tuas contas nas casas.',
      lang: 'pt-PT',
      start_url: '/',
      display: 'standalone',
      background_color: C.papel,
      theme_color: C.papel,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
);

// Logótipo com o nome: o texto é desenhado com a Fraunces instalada (Fontsource) num browser sem cabeça.
const fontUrl = new URL(
  '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2',
  import.meta.url,
).href;
const lockup = (textColor, fill, rule, bg) => `<!doctype html><html><head><style>
@font-face { font-family: F; src: url('${fontUrl}') format('woff2'); font-weight: 100 900; }
html, body { margin: 0; background: ${bg}; }
.l { display: inline-flex; align-items: center; gap: 30px; padding: 24px 32px; }
.t { font-family: F; font-size: 132px; line-height: 1; letter-spacing: -0.02em; color: ${textColor}; font-variation-settings: 'SOFT' 50, 'opsz' 144; }
</style></head><body><div class="l"><svg width="112" height="112" viewBox="0 0 48 48">${mark(fill, rule)}</svg><span class="t">Tento</span></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const [file, html] of [
  ['brand/logo-light.png', lockup(C.tinta, C.cobalto, C.tinta, 'transparent')],
  ['brand/logo-dark.png', lockup(C.texto, C.positivo, C.texto, 'transparent')],
]) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.l').screenshot({ path: file, omitBackground: true });
}
await browser.close();
console.log('Marca gerada: brand/, public/');

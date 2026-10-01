/* global document */
// Gera brand/social-preview.png (1280×640): imagem de pré-visualização social do repositório.
// Cores e tipografia da marca (direção G «Balanço» + T2); os valores do gráfico são fictícios.
// Uso: node scripts/social-preview.mjs   (depois, carregar em Settings > Social preview, no GitHub)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const font = (pkg, file) => new URL(`../node_modules/${pkg}/files/${file}`, import.meta.url).href;
const FRAUNCES = font('@fontsource-variable/fraunces', 'fraunces-latin-full-normal.woff2');
const FRAUNCES_I = font('@fontsource-variable/fraunces', 'fraunces-latin-full-italic.woff2');
const SANS = font('@fontsource-variable/instrument-sans', 'instrument-sans-latin-wght-normal.woff2');
const MONO = font('@fontsource/dm-mono', 'dm-mono-latin-400-normal.woff2');

const TOKEN =
  'M9 21a15 15 0 1 0 30 0a15 15 0 1 0 -30 0Z M14 21a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z M17 21a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z';

// Resultado acumulado mensal (fictício), em euros.
const SERIES = [120, 0, -180, -130, -290, 20, -90, -220, -160, -410, -380, -664.5];
const W = 520;
const H = 230;
const MIN = -720;
const MAX = 180;
const x = (i) => (i / (SERIES.length - 1)) * W;
const y = (v) => ((MAX - v) / (MAX - MIN)) * H;
const pts = SERIES.map((v, i) => [x(i), y(v)]);
// Curva suave (Catmull-Rom convertida em Bézier).
let d = `M${pts[0][0]},${pts[0][1]}`;
for (let i = 0; i < pts.length - 1; i++) {
  const p0 = pts[i - 1] ?? pts[i];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[i + 2] ?? p2;
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
}
const zero = y(0);
const last = pts[pts.length - 1];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: F; src: url('${FRAUNCES}') format('woff2'); font-weight: 100 900; }
@font-face { font-family: F; src: url('${FRAUNCES_I}') format('woff2'); font-weight: 100 900; font-style: italic; }
@font-face { font-family: S; src: url('${SANS}') format('woff2'); font-weight: 400 700; }
@font-face { font-family: M; src: url('${MONO}') format('woff2'); }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1280px; height: 640px; background: #f4f1ea; overflow: hidden; }
.page { position: relative; width: 1280px; height: 640px; padding: 88px 96px; display: flex; gap: 64px; align-items: center; }
.left { flex: 1; display: flex; flex-direction: column; gap: 28px; }
.lock { display: flex; align-items: center; gap: 22px; }
.name { font-family: F; font-size: 124px; line-height: 1; letter-spacing: -0.02em; color: #17191f; font-variation-settings: 'SOFT' 50, 'opsz' 144; }
.tag { font-family: F; font-style: italic; font-size: 30px; line-height: 1.3; color: #4a4f5c; max-width: 480px; }
.meta { font-family: M; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: #4a4f5c; }
.card { width: 560px; background: #fbfaf6; border: 1px solid #d9d4c7; border-radius: 14px; padding: 28px 20px 22px 20px; }
.eyebrow { font-family: M; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #4a4f5c; padding-left: 20px; }
.big { display: flex; align-items: baseline; gap: 12px; padding: 8px 0 0 20px; font-family: F; font-size: 64px; line-height: 1.1; color: #b0322a; font-variation-settings: 'SOFT' 50, 'opsz' 144; }
.big small { font-size: 26px; }
svg.chart { display: block; margin: 14px auto 0; }
.foot { font-family: S; font-size: 15px; color: #4a4f5c; padding: 10px 20px 0; display: flex; justify-content: space-between; }
</style></head><body><div class="page">
<div class="left">
  <div class="lock">
    <svg width="104" height="104" viewBox="0 0 48 48"><path d="${TOKEN}" fill-rule="evenodd" fill="#2336c8"/><rect x="5" y="40" width="38" height="3.5" rx="1" fill="#17191f"/></svg>
    <span class="name">Tento</span>
  </div>
  <p class="tag">O fluxo de caixa das tuas contas nas casas de apostas, lido com a calma de um relatório.</p>
  <p class="meta">Depositado · Levantado · Resultado líquido</p>
</div>
<div class="card">
  <div class="eyebrow">Resultado acumulado</div>
  <div class="big"><span>−664,50</span><small>€</small></div>
  <svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible">
    <defs>
      <pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="6" fill="#e0564a" opacity="0.45"/></pattern>
      <clipPath id="below"><rect x="0" y="${zero}" width="${W}" height="${H - zero + 20}"/></clipPath>
      <clipPath id="above"><rect x="0" y="-20" width="${W}" height="${zero + 20}"/></clipPath>
    </defs>
    <path d="${d} L${W},${zero} L0,${zero} Z" fill="url(#h)" clip-path="url(#below)"/>
    <path d="${d} L${W},${zero} L0,${zero} Z" fill="#dde1fa" clip-path="url(#above)"/>
    <line x1="0" y1="${zero}" x2="${W}" y2="${zero}" stroke="#17191f" stroke-width="1.2"/>
    <path d="${d}" fill="none" stroke="#17191f" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="#e0564a"/>
  </svg>
  <div class="foot"><span>out 2025</span><span>set 2026</span></div>
</div>
</div></body></html>`;

mkdirSync('brand', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
// Ficheiro temporário: a partir de about:blank o browser não carrega as fontes locais (file://).
const dir = mkdtempSync(join(tmpdir(), 'tento-social-'));
writeFileSync(join(dir, 'index.html'), html);
await page.goto(pathToFileURL(join(dir, 'index.html')).href);
await page.evaluate(() =>
  Promise.all(
    ['124px F', 'italic 30px F', '15px S', '13px M'].map((f) => document.fonts.load(f, 'Tento 0123 áç')),
  ),
);
await page.screenshot({ path: 'brand/social-preview.png' });
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log('Gerado brand/social-preview.png (1280×640)');

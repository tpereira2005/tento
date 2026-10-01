import type { MiddlewareHandler } from 'hono';

/*
 * Cabeçalhos de segurança, definidos UMA só vez e partilhados por:
 *  - o servidor Node (API e ficheiros de `dist/`);
 *  - o Worker do Cloudflare (respostas da API);
 *  - o ficheiro `dist/_headers` (ficheiros estáticos servidos pelo Cloudflare, que não passam pelo Worker).
 * Módulo neutro quanto ao runtime: sem imports de `node:`.
 */

export interface SecurityHeaderOptions {
  /** A aplicação é servida por https (ativa HSTS e `upgrade-insecure-requests`). */
  https: boolean;
}

/**
 * Política de conteúdo. Notas:
 *  - `script-src 'self' 'wasm-unsafe-eval'`: sem scripts inline (o tema inicial vive em
 *    `public/theme-init.js`) e sem `unsafe-eval`. O `'wasm-unsafe-eval'` é necessário: o relatório PDF
 *    (@react-pdf/renderer) carrega o motor de layout yoga como WebAssembly, e o Chrome só o compila com
 *    esta fonte (verificado empiricamente: sem ela a geração do PDF falha). Não permite `eval()` de JS.
 *  - `connect-src ... data:`: o yoga embute o `.wasm` em base64 e o carrega com `fetch('data:...')`.
 *    Um `data:` em `connect-src` não permite contactar nenhum servidor.
 *  - `style-src 'unsafe-inline'`: o React, o Radix e os gráficos escrevem atributos `style` em linha
 *    (posições, larguras, variáveis CSS). Não há scripts inline, por isso o risco restante é baixo.
 *  - `blob:` em `img-src`/`worker-src`: pré-visualização e geração do PDF no browser.
 */
export function contentSecurityPolicy({ https }: SecurityHeaderOptions): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Conjunto completo de cabeçalhos de segurança. */
export function securityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': contentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (options.https) headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains';
  return headers;
}

/** Ficheiro `_headers` do Cloudflare (Workers Static Assets / Pages): um bloco `/*` com todos os cabeçalhos. */
export function cloudflareHeadersFile(options: SecurityHeaderOptions): string {
  const lines = Object.entries(securityHeaders(options)).map(([name, value]) => `  ${name}: ${value}`);
  return `/*\n${lines.join('\n')}\n`;
}

/** `true` se o endereço base da aplicação é https. */
export const isHttps = (baseURL: string): boolean => baseURL.startsWith('https://');

/** Middleware Hono: aplica os cabeçalhos a todas as respostas (substitui valores já definidos). */
export function securityHeadersMiddleware(options: SecurityHeaderOptions): MiddlewareHandler {
  const headers = Object.entries(securityHeaders(options));
  return async (c, next) => {
    await next();
    for (const [name, value] of headers) c.res.headers.set(name, value);
  };
}

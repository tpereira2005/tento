import { describe, expect, it } from 'vitest';
import { serveSiteAsset } from './sites';

const assets = {
  '/index.html': {
    base64: btoa('<main>Tento</main>'),
    contentType: 'text/html; charset=utf-8',
    etag: '"html"',
  },
  '/assets/app.js': {
    base64: btoa('export const app = true;'),
    contentType: 'text/javascript; charset=utf-8',
    etag: '"js"',
  },
};
const req = (path: string, init?: RequestInit) => new Request(`https://tento.exemplo.test${path}`, init);

describe('ativos no Sites', () => {
  it.each(['/', '/entrar', '/registar', '/transacoes', '/nao-existe'])(
    'serve a SPA em %s com todos os cabeçalhos de segurança',
    async (path) => {
      const response = serveSiteAsset(req(path), assets);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<main>Tento</main>');
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('strict-transport-security')).toContain('max-age=');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
    },
  );

  it('serve JS com tipo correto, cache e CSP, sem transformar ativos em HTML', async () => {
    const response = serveSiteAsset(req('/assets/app.js'), assets);
    expect(await response.text()).toBe('export const app = true;');
    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
    const missing = serveSiteAsset(req('/assets/missing.js'), assets);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-security-policy')).toBeTruthy();
  });

  it('HEAD e revalidação não enviam corpo e mantêm os cabeçalhos', async () => {
    const head = serveSiteAsset(req('/entrar', { method: 'HEAD' }), assets);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect(head.headers.get('content-length')).toBe('18');
    const cached = serveSiteAsset(req('/index.html', { headers: { 'if-none-match': '"html"' } }), assets);
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    expect(cached.headers.get('content-security-policy')).toBeTruthy();
  });

  it('recusa escritas em ativos', () => {
    const response = serveSiteAsset(req('/index.html', { method: 'POST' }), assets);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});

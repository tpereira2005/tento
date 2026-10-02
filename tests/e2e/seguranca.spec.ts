import { expect, test } from '@playwright/test';
import { watchCsp } from './helpers';

/**
 * Na entrada Worker os ficheiros estáticos vêm de `dist/_headers`, gerado sempre para produção (https);
 * as respostas da API vêm do middleware, que segue o endereço do servidor (aqui http).
 */
const staticFromHeadersFile = process.env.TENTO_E2E_TARGET === 'worker';

const PAGES = ['/', '/transacoes', '/importar', '/comparar', '/relatorios', '/definicoes'] as const;

test.describe('Cabeçalhos de segurança', () => {
  test.skip(({ isMobile }) => isMobile, 'os cabeçalhos não dependem do ecrã');

  for (const path of ['/', '/transacoes', '/favicon.svg', '/theme-init.js', '/api/setup']) {
    test(`${path} leva CSP, frame-ancestors e restantes cabeçalhos`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['cross-origin-opener-policy']).toBe('same-origin');
      if (staticFromHeadersFile && !path.startsWith('/api/')) {
        expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
        expect(csp).toContain('upgrade-insecure-requests');
      } else {
        // o servidor E2E é http: sem HSTS nem upgrade-insecure-requests
        expect(h['strict-transport-security']).toBeUndefined();
        expect(csp).not.toContain('upgrade-insecure-requests');
      }
    });
  }

  test('o HTML servido não tem scripts inline', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)];
    expect(inline).toEqual([]);
  });

  test('nenhuma página da aplicação viola a política de segurança', async ({ page }) => {
    const violations = watchCsp(page);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(violations).toEqual([]);
  });
});

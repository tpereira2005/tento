import { describe, expect, it } from 'vitest';
import { cloudflareHeadersFile, contentSecurityPolicy, securityHeaders } from './security';

describe('cabeçalhos de segurança', () => {
  it('CSP estrita: sem scripts inline nem eval (só WebAssembly), sem enquadramento nem plugins', () => {
    const csp = contentSecurityPolicy({ https: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).toContain("connect-src 'self' data:;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('HSTS e upgrade-insecure-requests só em https', () => {
    const http = securityHeaders({ https: false });
    expect(http['Strict-Transport-Security']).toBeUndefined();
    expect(http['Content-Security-Policy']).not.toContain('upgrade-insecure-requests');

    const https = securityHeaders({ https: true });
    expect(https['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
    expect(https['Content-Security-Policy']).toContain('upgrade-insecure-requests');
  });

  it('inclui os restantes cabeçalhos', () => {
    expect(securityHeaders({ https: false })).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    expect(securityHeaders({ https: false })['Permissions-Policy']).toContain('camera=()');
  });

  it('o ficheiro _headers do Cloudflare usa os mesmos valores', () => {
    const file = cloudflareHeadersFile({ https: true });
    expect(file.startsWith('/*\n')).toBe(true);
    for (const [name, value] of Object.entries(securityHeaders({ https: true }))) {
      expect(file).toContain(`  ${name}: ${value}\n`);
    }
  });
});

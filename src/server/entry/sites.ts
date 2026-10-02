import { securityHeaders } from '../security';
import worker, { type WorkerEnv } from './worker';

export interface SiteAsset {
  base64: string;
  contentType: string;
  etag: string;
}

type SiteAssets = Readonly<Record<string, SiteAsset>>;
type SitesEnv = Omit<WorkerEnv, 'ASSETS'>;

/** O Sites não aplica `_headers` nem o fallback da SPA: estes ativos passam pelo Worker. */
export function serveSiteAsset(request: Request, assets: SiteAssets): Response {
  const headers = new Headers(securityHeaders({ https: true }));
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers.set('Allow', 'GET, HEAD');
    return new Response(null, { status: 405, headers });
  }
  const pathname = new URL(request.url).pathname;
  const asset =
    assets[pathname === '/' ? '/index.html' : pathname] ??
    (!pathname.split('/').at(-1)?.includes('.') ? assets['/index.html'] : undefined);
  if (!asset) return new Response(null, { status: 404, headers });
  headers.set('Content-Type', asset.contentType);
  headers.set('ETag', asset.etag);
  headers.set(
    'Cache-Control',
    pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  if (request.headers.get('if-none-match') === asset.etag) {
    return new Response(null, { status: 304, headers });
  }
  const body = Uint8Array.from(atob(asset.base64), (char) => char.charCodeAt(0));
  headers.set('Content-Length', String(body.byteLength));
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}

/** Reutiliza a API Worker + D1; só os ativos do build são adaptados ao Sites. */
export function createSitesWorker(assets: SiteAssets) {
  const environments = new WeakMap<SitesEnv, WorkerEnv>();
  return {
    fetch(request: Request, env: SitesEnv): Response | Promise<Response> {
      if (!new URL(request.url).pathname.startsWith('/api/')) return serveSiteAsset(request, assets);
      let adapted = environments.get(env);
      if (!adapted) {
        adapted = { ...env, ASSETS: { fetch: (req) => Promise.resolve(serveSiteAsset(req, assets)) } };
        environments.set(env, adapted);
      }
      return worker.fetch(request, adapted);
    },
  };
}

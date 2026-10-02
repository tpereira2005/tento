import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { cloudflareHeadersFile } from './src/server/security';

/** Emite `dist/_headers` (Cloudflare) a partir da mesma definição dos cabeçalhos de segurança do servidor. */
function securityHeadersFile(): Plugin {
  return {
    name: 'tento-security-headers',
    apply: 'build',
    generateBundle() {
      // a hospedagem de produção é https
      this.emitFile({ type: 'asset', fileName: '_headers', source: cloudflareHeadersFile({ https: true }) });
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/web/routes',
      generatedRouteTree: './src/web/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    securityHeadersFile(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:8787' } },
  preview: { port: 4173, strictPort: true },
});

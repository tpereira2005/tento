import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    projects: [
      { extends: true, test: { name: 'core', include: ['src/core/**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'web', include: ['src/web/**/*.test.{ts,tsx}'], environment: 'jsdom' } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/web/ui/**'],
      exclude: ['**/*.test.*', '**/index.ts'],
      reporter: ['text', 'html'],
    },
  },
});

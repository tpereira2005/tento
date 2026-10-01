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
      {
        extends: true,
        test: {
          name: 'web',
          include: ['src/web/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          testTimeout: 20_000,
        },
      },
      { extends: true, test: { name: 'server', include: ['src/server/**/*.test.ts'], environment: 'node' } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/web/ui/**', 'src/server/**'],
      exclude: [
        '**/*.test.*',
        '**/index.ts',
        'src/server/db/test-utils.ts',
        'src/server/db/schema.ts',
        'src/server/db/seed.ts',
        'src/server/db/demo-dataset.ts',
        'src/server/entry/**',
        'src/server/test-app.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});

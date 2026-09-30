import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Fronteiras entre camadas (ver AGENTS.md): core é puro; web não importa server.
const coreBoundaries = {
  patterns: [
    {
      group: ['@/web/*', '@/server/*', '../web/*', '../server/*'],
      message: 'src/core é puro: não importa web nem server.',
    },
    { group: ['react', 'react-dom', 'react/*'], message: 'src/core não depende de React.' },
  ],
};
const webBoundaries = {
  patterns: [
    {
      group: ['@/server/*', '../server/*', '../../server/*'],
      message: 'src/web não importa src/server; usa a API.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'src/web/routeTree.gen.ts',
      'docs/design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js', '*.mjs', 'scripts/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      'no-restricted-imports': ['error', webBoundaries],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', coreBoundaries] },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);

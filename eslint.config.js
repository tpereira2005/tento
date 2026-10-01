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
      group: ['@/server/*', '../server/*', '../../server/*', '../../../server/*'],
      // Só tipos (os contratos da API); nunca código do servidor no browser.
      allowTypeImports: true,
      message: 'src/web não importa código de src/server; usa a API (import type é permitido).',
    },
  ],
};

// Datas no domínio: só através de src/core/dates.ts (texto ISO); nunca hora local.
const noDateInCore = [
  { selector: "NewExpression[callee.name='Date']", message: 'Usa src/core/dates.ts (datas como texto ISO).' },
  {
    selector: "MemberExpression[object.name='Date'][property.name='parse']",
    message: 'Usa parseDate de src/core/dates.ts.',
  },
];
const noLocalTimeGetters = [
  {
    selector:
      'MemberExpression[property.name=/^(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setFullYear|setMonth|setDate|toLocaleDateString)$/]',
    message:
      'Hora local proibida no domínio (bugs de fuso horário). Usa as funções UTC de src/core/dates.ts.',
  },
];

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
      // O TanStack Router usa `throw redirect(...)` / `throw notFound()` para controlar a navegação.
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [{ from: 'package', package: '@tanstack/router-core', name: ['Redirect', 'NotFoundError'] }],
        },
      ],
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
    rules: {
      'no-restricted-imports': ['error', coreBoundaries],
      'no-restricted-syntax': ['error', ...noDateInCore, ...noLocalTimeGetters],
    },
  },
  {
    // dates.ts é o único sítio com `Date`, e só em UTC
    files: ['src/core/dates.ts'],
    rules: { 'no-restricted-syntax': ['error', ...noLocalTimeGetters] },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);

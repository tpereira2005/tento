/** Textos da interface em pt-PT. É a fonte de verdade: en.ts tem de ter exatamente as mesmas chaves. */
export const ptPT = {
  app: {
    name: 'Tento',
    tagline: 'O fluxo de caixa das tuas contas nas casas.',
  },
  nav: {
    label: 'Principal',
    dashboard: 'Painel',
    transactions: 'Transações',
    import: 'Importar',
    compare: 'Comparar',
    reports: 'Relatórios',
    settings: 'Definições',
  },
  theme: {
    toDark: 'Mudar para tema escuro',
    toLight: 'Mudar para tema claro',
  },
  common: {
    positive: 'positivo',
    negative: 'negativo',
    close: 'Fechar',
    exampleData: 'Dados de exemplo',
  },
  home: {
    title: 'Em construção',
    body: 'A etapa 0 montou as fundações: identidade, componentes e ferramentas. O painel chega na etapa 5.',
    componentsLink: 'Ver componentes',
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof ptPT>;

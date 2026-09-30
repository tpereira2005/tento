# Plano de implementação — Tento

Versão 1 · aprovada a 2026-09-30.

> Nome escolhido: **Tento** (neste plano ainda aparece o nome provisório «Balanço»). Pasta `C:\Users\tomas\Documents\tento`, repositório privado `tpereira2005/tento`.

## 1. Decisões já tomadas

| Tema             | Decisão                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto          | Análise do fluxo de caixa (depósitos e levantamentos) por **casa**, **perfil** e **conta** (conta = perfil × casa). Não há apostas individuais nem saldo manual.                          |
| Métricas         | Resultado líquido = levantado − depositado. "Meses positivos" em vez de "win rate". O limite mensal fica **fora**.                                                                        |
| Dados de entrada | Cada CSV corresponde a uma conta (uma casa e um perfil). Cabeçalho `Date;Tipe;Vaule` (com aliases), separador `;`, decimal com vírgula e BOM.                                             |
| Utilizadores     | Login e acesso pela web em vários dispositivos. Tudo pertence ao teu utilizador.                                                                                                          |
| Alojamento       | Desenvolvimento local; migração final para ChatGPT Sites (Cloudflare Workers + D1). A arquitetura não fica presa a nenhum fornecedor.                                                     |
| Identidade       | Direção **G** (cores Balanço, layout final, claro/escuro/móvel) com a tipografia **T2**: Fraunces (títulos e números grandes), Instrument Sans (interface) e DM Mono (tabelas e rótulos). |
| Idioma           | pt-PT, com estrutura pronta para inglês.                                                                                                                                                  |
| Relatório        | PDF com design próprio, gerado no browser.                                                                                                                                                |

## 2. Stack

| Camada            | Escolha                                                                      | Porquê                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Linguagem         | TypeScript `strict`, sem `any` (regra de lint)                               | Evita os buracos de tipos do v1.                                                                                                    |
| Frontend          | Vite + React 19, SPA estática                                                | Aloja-se em qualquer lado.                                                                                                          |
| Routing           | TanStack Router                                                              | Rotas tipadas; filtros no URL (`?perfil=&casa=&periodo=`), que ficam partilháveis e testáveis.                                      |
| Dados no cliente  | TanStack Query                                                               | Cache, estados de carregamento e erro explícitos. Um erro nunca aparece como "sem dados".                                           |
| API               | Hono                                                                         | Corre sem alterações em Node, Cloudflare Workers, Bun e Deno.                                                                       |
| Base de dados     | SQLite com Drizzle ORM; migrações SQL no repositório                         | Localmente é um ficheiro; em Cloudflare/Sites é D1; noutro alojamento pode ser Turso.                                               |
| Autenticação      | Better Auth (sessões na mesma BD, cookies `HttpOnly`)                        | Autoalojado e portátil. "Sign in with ChatGPT" entra depois como fornecedor OIDC.                                                   |
| Validação         | zod, com os mesmos esquemas no cliente e no servidor                         | Uma única fonte de verdade.                                                                                                         |
| CSV               | papaparse mais o nosso parser de números e datas                             | Suporta aspas, BOM e `1.234,56`.                                                                                                    |
| UI                | Tailwind v4 com tokens CSS (claro/escuro) e primitivas Radix                 | Acessível por omissão.                                                                                                              |
| Gráficos          | SVG próprio com `d3-scale` e `d3-shape` (`curveMonotoneX`)                   | Reproduz fielmente o design (tracejado abaixo de zero, rótulos diretos, mapa de quadrados). A mesma geometria serve o ecrã e o PDF. |
| PDF               | `@react-pdf/renderer`, carregado só ao exportar                              | Vetorial, com fontes embutidas; sem html2canvas nem Puppeteer.                                                                      |
| Fontes            | Alojadas localmente (Fontsource e TTF para o PDF), todas com licença OFL     | Sem pedidos ao Google em runtime (privacidade), e funciona offline.                                                                 |
| Testes            | Vitest (+ fast-check), Testing Library, Playwright + axe                     |                                                                                                                                     |
| Qualidade         | ESLint 9 flat + typescript-eslint strict, Prettier, GitHub Actions, gitleaks |                                                                                                                                     |
| Gestor de pacotes | pnpm                                                                         |                                                                                                                                     |

## 3. Estrutura de pastas

É um único pacote, sem monorepo. As fronteiras entre camadas são garantidas por regras de lint (`no-restricted-imports`): `core` não importa nada de `web` nem de `server`, e `web` não importa `server`.

```
balanco/
├─ src/
│  ├─ core/                  # domínio puro, sem I/O; usado pela web, pelo servidor e pelo PDF
│  │  ├─ money.ts            # cêntimos inteiros, parse e formatação pt-PT
│  │  ├─ dates.ts            # datas ISO 'AAAA-MM-DD' como texto; meses de calendário
│  │  ├─ csv/                # headers.ts, numbers.ts, parse.ts, diff.ts (multiset), report.ts
│  │  ├─ stats/              # summary, monthly, cumulative, streaks, heatmap, breakdown, compare
│  │  ├─ insights/           # regras determinísticas, com prioridade
│  │  ├─ charts/             # geometria: escalas, caminho monótono, barras, células
│  │  └─ schemas.ts          # esquemas zod partilhados com a API
│  ├─ server/
│  │  ├─ app.ts              # Hono: rotas, middleware, erros
│  │  ├─ routes/             # accounts, bookmakers, profiles, imports, transactions, stats, me
│  │  ├─ auth.ts             # Better Auth
│  │  ├─ db/                 # schema.ts, client.ts (porta), repos/ (todas filtram por userId)
│  │  └─ entry/              # node.ts (desenvolvimento/Docker), worker.ts (Cloudflare/Sites)
│  └─ web/
│     ├─ main.tsx, router.tsx
│     ├─ features/           # painel, importar, transacoes, comparar, relatorios, definicoes, auth
│     ├─ ui/                 # Button, Select, Segmented, Card, Dialog, Table, Toast, Skeleton…
│     ├─ charts/             # CumulativeChart, MonthlyBars, DepositHeatmap, ChartAsTable
│     ├─ pdf/                # Report.tsx, páginas e fontes
│     ├─ i18n/               # pt-PT.ts (fonte), en.ts (mesmas chaves), t() tipado
│     └─ styles/             # tokens.css (claro/escuro), fonts.css
├─ drizzle/                  # migrações SQL geradas e versionadas
├─ tests/
│  ├─ e2e/                   # Playwright
│  └─ fixtures/              # só CSVs SINTÉTICOS
├─ scripts/                  # seed de demonstração, verificação de CSVs reais (fora do repo)
├─ docs/                     # ARQUITETURA.md, DECISOES.md, MIGRACAO.md (para o Codex)
└─ .github/workflows/ci.yml
```

## 4. Modelo de dados (SQLite)

- **Better Auth:** `user`, `session`, `account`, `verification`. São geridas pela biblioteca.
- **`bookmaker`** (casa): `id`, `user_id`, `name`, `slug`; único por `(user_id, slug)`.
- **`profile`** (perfil): `id`, `user_id`, `name` (por exemplo "Ana", "Rui").
- **`wallet`** (conta = perfil × casa): `id`, `user_id`, `profile_id`, `bookmaker_id`; único por `(profile_id, bookmaker_id)`.
- **`import_batch`**: `id`, `user_id`, `wallet_id`, `filename`, `file_sha256`, `rows_total`, `rows_added`, `rows_duplicate`, `rows_invalid`, `created_at`, `undone_at`.
- **`txn`** (transação): `id`, `user_id`, `wallet_id`, `date` (texto ISO), `type` (`deposit` ou `withdrawal`), `amount_cents` (inteiro, > 0), `seq` (ordem dentro do dia), `source` (`csv` ou `manual`), `import_batch_id`, `note`, `created_at`, `updated_at`. Índice em `(wallet_id, date)`.
- **`user_settings`**: `theme`, `locale`, filtros por omissão.

O ficheiro CSV original **não é guardado**: só as linhas validadas e o hash do ficheiro. O isolamento entre utilizadores é garantido na camada de repositórios (o SQLite não tem RLS) e coberto por testes específicos.

## 5. Funcionalidades priorizadas

**P0 — essencial (MVP)**

1. Registo e login; fecho do registo público depois do primeiro utilizador.
2. Casas, perfis e contas: criar, renomear e apagar.
3. Importação de CSV: pré-visualização, relatório por linha, diff multiset, conflitos, inserção atómica, desfazer um import.
4. Painel da direção G: resumo, acumulado, mensal, dias com depósito, perfil vs perfil, por casa, contas, destaques, transações recentes.
5. Filtros (perfil, casa, período) guardados no URL; tema claro/escuro; layout móvel.

**P1 — completo**

6. Página de transações: pesquisa, filtros, paginação no servidor, adicionar, editar e apagar à mão.
7. Comparar: perfil vs perfil, casa vs casa, período vs período homólogo.
8. Relatório PDF de 4 páginas: capa com KPIs, evolução, por conta/casa/perfil, transações.
9. Exportar dados (CSV no formato original e JSON) e apagar a conta.

**P2 — acabamento**

10. Mais regras de destaques, por exemplo a tendência homóloga e a sequência de meses negativos.
11. Estrutura em inglês preenchida (tradução revista).
12. Adaptador Worker + D1 testado; guia `MIGRACAO.md` para o Codex.

**Fora de âmbito (por agora):** apostas individuais, saldo manual por casa, limite mensal, partilha com outros utilizadores, notificações, PWA offline.

## 6. Etapas e critérios de "concluído"

No fim de cada etapa verifico eu próprio: lint, typecheck, testes, build, e comparação visual com os mockups em claro, escuro e móvel. Só depois te apresento o resultado. As tarefas bem delimitadas vão para subagentes Sonnet 5.5; as decisões e a integração ficam comigo.

### Etapa 0 — Fundações

**Âmbito:**

- Repositório.
- Tooling: TS strict, ESLint com fronteiras entre camadas, Prettier, Vitest, Playwright.
- CI no GitHub Actions.
- Proteção contra dados reais:
  - `.gitignore` para `*.csv` e `*.xlsx`, exceto `tests/fixtures`.
  - Hook de pre-commit que bloqueia CSVs fora de `tests/fixtures`.
  - gitleaks no CI.
- Tokens de cor claro/escuro e fontes T2 alojadas localmente.
- Componentes base e uma página de desenvolvimento com todos os componentes.

**Concluído quando:**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passam localmente e no CI.
- A página de componentes corresponde à prancha de identidade T2, em claro e escuro.
- Tentar fazer commit de `x.csv` fora de `tests/fixtures` falha.
- axe não encontra violações na página de componentes.

### Etapa 1 — Núcleo de domínio (`src/core`)

**Âmbito:**

- Dinheiro em cêntimos; datas ISO.
- Parser de CSV com aliases, deteção de separador e de formato decimal, BOM, aspas e relatório de erros por linha.
- Diff multiset e deteção de conflitos.
- Estatísticas: resumo, séries mensal e acumulada, sequências por meses de calendário (meses vazios contam como 0), mapa diário, repartições por conta/casa/perfil, comparações.
- Destaques.
- Geometria dos gráficos.

**Concluído quando:**

- Cobertura de testes ≥ 95 % em `core`.
- Testes de propriedades (fast-check) para `parseAmount` e `formatAmount`: ida e volta sem perda; `1.234,56`, `1,234.56`, `20`, `20,00` e `-5` tratados como especificado.
- Os teus dois CSVs reais, lidos de uma pasta **fora do repositório** e indicada por variável de ambiente, importam com 0 erros e o número de linhas coincide com o ficheiro. Os totais coincidem com um cálculo independente feito por script.
- Nenhuma função de `core` usa `new Date()` com texto nem `getMonth()` local (regra de lint).

### Etapa 2 — Base de dados, API e autenticação

**Âmbito:**

- Esquema Drizzle e migrações.
- Repositórios filtrados por `userId`.
- Rotas Hono com validação zod.
- Better Auth com email e palavra-passe, limite de tentativas e registo fechado depois do primeiro utilizador.
- Dados de demonstração (seed).
- Entrada Node.

**Concluído quando:**

- Os testes de integração sobre SQLite em memória cobrem todas as rotas.
- Um teste prova que o utilizador B não consegue ler, alterar nem apagar dados do utilizador A em nenhuma rota.
- A importação é atómica: uma falha a meio não deixa linhas inseridas.
- As estatísticas devolvidas pela API coincidem com as de `core` para os mesmos dados.

### Etapa 3 — Estrutura da aplicação e definições

**Âmbito:**

- Layout com a barra de navegação e o botão de tema; separadores em baixo no móvel.
- Páginas de entrar e registar.
- Definições: casas, perfis, contas e conta do utilizador.
- Estados vazios, de carregamento e de erro.

**Concluído quando:**

- Um teste E2E faz registo → login → criar 2 casas, 2 perfis e 3 contas → logout.
- axe sem violações; navegação completa só com teclado; zoom a 200 % sem perda de conteúdo.

### Etapa 4 — Importação

**Âmbito:** assistente com os passos escolher conta → carregar ficheiro → pré-visualizar (novas, duplicadas, inválidas, conflitos) → confirmar → resumo, com a opção "desfazer este import".

**Concluído quando:**

- E2E com CSVs sintéticos: importar; reimportar o mesmo ficheiro (0 novas); importar um ficheiro com uma linha editada (1 conflito mostrado); desfazer (volta ao estado anterior).
- Os teus CSVs reais importam localmente com os totais esperados. Esta verificação é manual e fica fora do CI.

### Etapa 5 — Painel

**Âmbito:** todos os blocos da direção G com a tipografia T2, filtros no URL, claro/escuro, móvel e "ver como tabela" em cada gráfico.

**Concluído quando:**

- As capturas do painel com os dados de exemplo coincidem visualmente com as pranchas G/T2 a 1440 px e a 390 px, em claro e escuro. Revejo-as lado a lado.
- Todos os números do painel coincidem com `core` (teste E2E sobre o seed).
- Carregamento inicial ≤ 200 KB de JS (gzip), com o PDF fora desse pacote; Lighthouse de acessibilidade ≥ 95.

### Etapa 6 — Transações e Comparar

**Âmbito:**

- Tabela com pesquisa, filtros e paginação no servidor.
- Criação, edição e remoção manual de transações, com confirmação.
- Página Comparar: perfis, casas e períodos homólogos.

**Concluído quando:**

- Os testes E2E da criação/edição/remoção manual passam, e o painel reflete as alterações.
- A comparação de períodos tem testes com meses em falta.

### Etapa 7 — Relatório PDF

**Âmbito:**

- 4 páginas com o design T2: capa, evolução, repartições e transações.
- Âmbito do relatório (perfil, casa, período) escolhido na página Relatórios.

**Concluído quando:**

- O PDF é gerado no browser em menos de 3 s para 1000 transações.
- As fontes vão embutidas e o texto é selecionável.
- Os números coincidem com o painel para o mesmo filtro.
- Revejo visualmente as 4 páginas.

### Etapa 8 — Endurecimento e portabilidade

**Âmbito:**

- Cabeçalhos de segurança (CSP, HSTS, `frame-ancestors`).
- Exportar e apagar todos os dados.
- Entrada `worker.ts` com D1 testada em workerd (Miniflare).
- README, `ARQUITETURA.md`, `DECISOES.md` e `MIGRACAO.md`, que explica ao Codex exatamente o que trocar para o ChatGPT Sites.

**Concluído quando:**

- A suíte E2E passa contra as duas entradas: Node + SQLite e Worker + D1 local.
- Os dados apagados desaparecem mesmo (verificado na BD).
- gitleaks e `pnpm audit` sem falhas altas ou críticas.

## 7. Regras de trabalho

- Commits pequenos e convencionais; cada etapa num ramo próprio, com PR para `main`; o merge (squash) é feito por mim com o CI verde e os critérios verificados — delegado pelo dono a 2026-09-30.
- Push para o GitHub e criação do repositório remoto só com a tua confirmação.
- Dados reais nunca entram no repositório, nos testes do CI nem nos artefactos publicados.
- Cada decisão técnica relevante fica registada em `docs/DECISOES.md`.

## 8. Decisões fechadas (2026-09-30)

1. **Pasta e repositório:** `C:\Users\tomas\<nome>` e repositório privado `tpereira2005/<nome>`. O nome ainda está por escolher entre as propostas de marca.
2. **Registo:** fechado automaticamente depois de criado o primeiro utilizador (o teu).
3. **Login:** email e palavra-passe.
4. **Ordem das etapas:** 0 a 8, como está.
5. **Instruções para agentes:** `AGENTS.md` na raiz, sem `CLAUDE.md`. Descreve stack, comandos, fronteiras entre camadas, convenções, regras de dados reais e critérios de "concluído". É criado na etapa 0 e atualizado no fim de cada etapa.
6. **GitHub organizado e bonito:**
   - **Etapa 0:** descrição, tópicos, `README.md` com logótipo e distintivos (CI, licença), templates de issues e de PR, etiquetas (`etapa:0…8`, `tipo:feature/bug/docs`, `prioridade:P0–P2`), um milestone por etapa, proteção do ramo `main` (CI obrigatório) e `.github/CODEOWNERS`.
   - **Durante o desenvolvimento:** um PR por etapa com descrição, checklist de "concluído" e capturas antes/depois; commits convencionais.
   - **Etapa 8:** README final com capturas claro/escuro/móvel e um GIF do fluxo de importação, `docs/` completo, CHANGELOG, release `v1.0.0` com notas, e uma imagem de pré-visualização social (1280×640) no estilo da marca.

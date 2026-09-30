# Relatório de análise — betano-dashboard, bet-tracker, bet-tracker-v2

Data: 2026-09-30 · Clones analisados em `C:\Users\tomas\bt-analise` · Todos os ramos verificados.
Método: build, typecheck, lint e testes executados em cada repositório; histórico git inspecionado à procura de segredos e dados pessoais; as falhas críticas foram confirmadas manualmente.

---

## 0. Duas conclusões que mudam tudo

1. **Os dados não são apostas.** Os teus CSVs têm 3 colunas: `Date;Tipe;Vaule`. Só existem 2 tipos (`Deposit`, `Withdrawal`). Não há apostas, odds, stakes nem cashouts. As três versões chamam "ROI" e "win rate" a métricas de fluxo de caixa:
   - O "win rate" é a percentagem de **meses** com saldo positivo.
   - O dinheiro que ainda está na casa de apostas conta como perda.

   O novo site tem de ser honesto quanto a isto, ou passar a modelar mais dados (ver §7, perguntas).

2. **Há dados financeiros reais publicados.** O `bet-tracker` era um repositório público com CSVs de transações reais (incluindo de outra pessoa) em **todos os ramos** desde o 1.º commit. _(Resolvido a 2026-09-30: os repositórios antigos passaram a privados.)_ Apagar o ficheiro não chega: está no histórico. **Ação imediata recomendada (tua):** tornar o repositório privado ou apagá-lo. Em alternativa, reescrever o histórico com `git filter-repo`.

---

## 1. Resumo de cada versão

|                    | **v1 — betano-dashboard**                                                              | **v2 — bet-tracker**                                                                            | **v3 — bet-tracker-v2**                                                              |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Período            | dez 2025 (173 commits)                                                                 | fev 2026 (16 commits, 4 ramos)                                                                  | fev 2026 (26 commits, 2 dias)                                                        |
| Stack              | Vite 7 + React 19 SPA, Recharts 3, Supabase, jsPDF/html2canvas, Puppeteer (serverless) | Monorepo pnpm/Turbo, Next 15, Tailwind 4, Supabase SSR, `packages/core`                         | Igual ao v2 mais Zustand, TanStack Query, Radix, CI GitHub Actions, husky/commitlint |
| Estilo             | `index.css` com **5355 linhas**, laranja Betano, glassmorphism                         | `globals.css` com 1012 linhas mais muitos `style={{}}` inline; Instrument Serif e esmeralda     | Tailwind + tokens em `globals.css` (204 linhas), esmeralda, dark-first               |
| Auth               | Email/password                                                                         | Email/password                                                                                  | Magic link + Google/GitHub OAuth                                                     |
| Build              | ✅ build · ❌ `tsc` (2 erros) · lint não cobre `.ts/.tsx`                              | ❌ **`next build` falha** (`useSearchParams` sem Suspense em `/auth/login`) · ❌ test · ❌ lint | ✅ build, lint, typecheck · ✅ 274 testes (229 core + 45 web)                        |
| Exportação         | PDF, PNG e CSV (3 implementações)                                                      | Nenhuma (botão sem handler)                                                                     | Nenhuma                                                                              |
| Comparar perfis    | ✅                                                                                     | Stub                                                                                            | ✅                                                                                   |
| Import incremental | ✅ merge com conflitos                                                                 | ✅ diff multiset                                                                                | ❌ **partido** (ver §3)                                                              |

**Ramos do bet-tracker:**

- `master` só tem o scaffold.
- `design-exploration` (tag `v1.1-stable`) tem a app real.
- `claude/confident-mendeleev` tem +9 correções.
- `design-baseline` (default) é o merge desse PR e é o único que vale a pena.

Não há arquiteturas alternativas em nenhum ramo.

**Evolução:**

- **v1:** uma SPA monolítica que cresceu por remendos. Cerca de 50 commits são só para arranjar a exportação PDF ("URGENT: revert…", margens mágicas de 150/180/220/300/400px).
- **v2:** a arquitetura melhora (o core puro fica separado da UI, com aliases de cabeçalho tolerantes), mas fica a meio e nem compila.
- **v3:** tem a melhor engenharia (testes, CI, ficheiros ≤300 linhas). Foi gerado em 2 dias "UI-first", sem nunca testar o fluxo principal de ponta a ponta. Perdeu a exportação e o merge com conflitos que o v1 tinha.

---

## 2. O que vale a pena manter (ideias, não código)

| O quê                                                                                               | Onde                                                                     | Porquê                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Diff multiset para import incremental                                                               | `bet-tracker-v2/packages/core/src/parsers/diff.ts`                       | Trata corretamente dois depósitos iguais de 20 € no mesmo dia (o v1 perdia-os: `transactionService.ts:215`) |
| Tabela de aliases de cabeçalho e de tipos                                                           | `bet-tracker-v2/packages/core/src/parsers/utils.ts:1-5`, `normalizeType` | Aceita `Tipe/Vaule`, `tipo/valor`, `levantamento`, etc.                                                     |
| Separar a lógica pura (core) da UI e testá-la                                                       | v3 `packages/core` (229 testes)                                          | Arquitetura certa, e as fórmulas ficam verificáveis                                                         |
| Wizard de import (analisar → pré-visualizar diff → confirmar) com `import_batch_id`                 | v3 `components/import/*`                                                 | Permite desfazer um import (ninguém chegou a ligar isto na UI)                                              |
| Resolução de conflitos (mesma data e tipo, valor diferente)                                         | v1 `ReloadModal.tsx` + v3 `detectConflicts` (não ligado)                 | Protege contra CSVs editados                                                                                |
| Perfis, vista "todas as contas" e comparação lado a lado                                            | v1 `ProfileComparison.tsx`, v3 `compare/page.tsx`                        | É a funcionalidade diferenciadora                                                                           |
| Gráfico acumulado com gradiente verde/vermelho que parte em y=0                                     | v3 `charts/cumulative-chart.tsx`                                         | Leitura imediata                                                                                            |
| Insights em pt-PT com padrão estratégia e prioridade                                                | v3 `calculations/insights/*`                                             | Boa base de texto (a lógica precisa de correções, §3)                                                       |
| "Recuperação após mês negativo" e tendência dos últimos 3 meses face aos 3 anteriores               | v1 `calculations.ts:168-199, 419-442`                                    | Os insights mais úteis das três versões                                                                     |
| `Intl.NumberFormat('pt-PT', EUR)`, skeletons, skip-link, error boundaries, `prefers-reduced-motion` | v1/v3                                                                    | Detalhes corretos                                                                                           |
| Identidade visual esmeralda "editorial"                                                             | v2/v3 tokens                                                             | Mais sóbria e profissional do que o laranja Betano do v1 (que ainda levanta a questão da marca registada)   |

---

## 3. Problemas, por gravidade

### 🔴 Críticos

1. **[Privacidade] CSVs reais num repositório público** — `bet-tracker`, todos os ramos (§0). Inclui dados de terceiros.
2. **[Correção] O import do v3 não funciona.** `import-form.tsx:132` grava `` `import-${Date.now()}` `` numa coluna `import_batch_id UUID` (`20260220000001_initial_schema.sql:42`), e o Postgres rejeita todas as linhas. Além disso, `betano.ts:121` valida a data com `parseDate` mas guarda `date: rawDate`, e `import-form.tsx:137` insere esse texto cru. Com um CSV `DD/MM/AAAA`, o dia e o mês trocam-se ou dá erro, e o diff (`:102-110`) compara formatos diferentes, por isso nunca deteta duplicados.
3. **[Correção] Truncagem silenciosa a 1000 linhas** (v2 `queries.ts:93-112`, v3 `lib/api/transactions.ts:31`). Usa `.select('*')` sem paginação, e o PostgREST corta por omissão em 1000. Os ficheiros reais já se aproximam desse limite. Quando passar de 1000, todos os KPIs ficam errados sem aviso, e o re-import duplica linhas.
4. **[Segurança] URL e anon key do Supabase hardcoded como fallback** (v1 `src/lib/supabase.ts:6-7`, commit `527779b`, projeto `[id-removido]`). A anon key é pública por desenho, mas as queries do v1 não filtram por `user_id` (`transactionService.ts:152-162`, `profileService.ts:70-78`) e o repositório não tem migrações nem políticas. **O isolamento entre utilizadores depende de RLS que não é verificável e pode não existir.** Confirma no painel do Supabase, ou desativa esse projeto.
5. **[Código] O build do v2 falha** (`/auth/login` com `useSearchParams` sem `<Suspense>`). Não é possível fazer deploy.

### 🟠 Altos

6. **[Correção] Modelo financeiro enganador (as três versões).**
   - `net = levantado − depositado` e `ROI = net / depositado`: o saldo na casa conta como perda.
   - O "Win rate" é a % de meses positivos (v1 `calculations.ts:413`, v3 `statistics.ts`), com uma etiqueta que sugere apostas ganhas.
7. **[Correção] O gráfico MoM mede o volume, não o resultado**: `prevNet = prev.deposits + prev.withdrawals` (v3 `monthly.ts:53`, igual no v2 `statistics.ts:394`).
8. **[Correção] Datas e fuso horário.** `new Date('2024-01-01')` é meia-noite UTC, mas o agrupamento usa `getMonth()` local (v2 `statistics.ts:289/358`, v3 `process.ts:106` / `monthly.ts:246`). Nos Açores (UTC−1) o dia 1 passa para o mês anterior. O v1 usa `substring(0,7)`, mas aceita qualquer formato `new Date()`, o que gera meses lixo.
9. **[Correção] Parsing de valores.**
   - v1: `.replace(',', '.')` só substitui a primeira vírgula (`1.234,56` passa a `1.234`), e `Math.abs` inverte sinais em silêncio (`calculations.ts:13-24`).
   - v3: `sanitizeValue("1.234")` devolve `1.23` e `"1,234.56"` devolve `1.23` (confirmado por teste do subagente).
   - Nenhuma versão suporta campos entre aspas (`line.split(';')`). O `papaparse` está instalado mas não é usado no v2 nem no v3.
10. **[Integridade] Imports não atómicos.**
    - v1 `saveTransactions` apaga e depois insere sem transação (`transactionService.ts:125-148`). Se um lote falhar, o perfil fica vazio.
    - v2/v3 inserem lotes de 500 sem rollback.
11. **[Correção] Streaks e tendência contam índices do array, não meses de calendário** (v3). Um intervalo de 5 meses sem dados conta como "consecutivo".
12. **[Correção] Insights duplicados e contraditórios** no v1: `id: 'volatility'` aparece 2× (`calculations.ts:154` e `:353`, com keys React duplicadas). A frequência é calculada com `n` num sítio e `n−1` noutro (`:234` vs `:462`). A volatilidade `stdDev/|média|` explode com média ≈ 0.
13. **[Privacidade] Dados financeiros com Vercel Analytics e Speed Insights sem consentimento** (v1).
14. **[Qualidade] As funcionalidades anunciadas não existem.**
    - v2: exportação, PDF, share, goals, compare, reset password e delete account têm botões sem handler, e `/auth/reset-password` não existe.
    - v3: o insight "Define Objetivos" remete para uma funcionalidade "Goals" que não existe.

### 🟡 Médios

15. **[Segurança] Open redirect** no v3 `auth/callback/route.ts:8,33`: `redirect(`${origin}${next}`)` com `next` controlado pelo utilizador (`?next=@evil.com`).
16. **[Segurança] RLS do v3:**
    - O insert em `transactions` não valida se o `platform_id` pertence ao utilizador.
    - Não há índice único parcial para `is_default`.
    - A migração não usada do v2 (`00001`) tem `reports_public_read` aberto a todos.
17. **[Código] Dependências mortas e vulneráveis.**
    - v1: `xlsx@0.18.5` (sem correção), `clsx`, `tailwind-merge`, puppeteer e chromium ficaram após o revert `2af91d8`. `npm audit`: 4 críticas e 22 altas.
    - v2: `jspdf`, `html2canvas`, `zustand`, `framer-motion`, `papaparse`, `date-fns` e `qrcode.react` sem imports.
    - v3: `framer-motion`, `sonner`, `react-select`, `react-tabs`, `popover`, `date-fns` e `papaparse`.
18. **[Código] Ficheiros gigantes e lixo versionado.**
    - v1: `index.css` 5355 linhas, `export.ts` 694, `export.ts.backup` versionado.
    - v2: `profiles/page.tsx` 620 linhas com 14 `useState`, e `upload-form.tsx` 504 linhas com um componente definido dentro do render (remonta a cada render). Tem também `tsc_errors.txt`, `*.tsbuildinfo` e `*.md.resolved.0` versionados.
19. **[Código] Erros engolidos.** Falhas de rede devolvem `[]` e aparece o ecrã "sem dados" (v1 `App.tsx:54-57`, v2 em todas as páginas).
20. **[Código] Tooling ilusório.**
    - v1: o ESLint só cobre `*.{js,jsx}` (`eslint.config.js:12`), e o `@testing-library/react` está instalado sem uso.
    - v2: `eslint` nem está instalado.
    - v3: o CLAUDE.md promete Playwright e 90% de cobertura, mas nenhum dos dois existe.
21. **[Desempenho] Bundle.** No v1, o chunk Dashboard tem 613 kB porque o jsPDF e o html2canvas são importados estaticamente. No v3, as páginas com Recharts têm cerca de 355 kB de first-load. Tudo é recalculado no cliente a cada filtro.
22. **[UX] Uma linha má chumba o import inteiro, mostrando só o 1.º erro** (v1). No v2/v3 é o contrário: as linhas más são ignoradas e aparece "sucesso". Nenhuma versão mostra um relatório por linha.

### 🔵 Acessibilidade (transversal)

23. O v1 bloqueia o zoom: `index.html:6` tem `maximum-scale=1.0, user-scalable=no` (falha WCAG 1.4.4).
24. Os gráficos não têm alternativa textual nem tabela. O positivo e o negativo distinguem-se só pela cor (e por emoji 🟢/🔴 no v2 `dashboard/page.tsx:158`).
25. Os modais do v1 são `<div>` sem `role="dialog"` nem focus trap. Os dropdowns do v2 não têm `aria-expanded`. O v3 tem 2 atributos `aria-*`/`role` em todo o código.
26. O contraste do `--text-muted` `#565870` sobre `#0b0c10` é cerca de 3:1 (v3), abaixo do mínimo AA.
27. O v3 tem strings sem acentos ("Transacoes", "Ola", "Visao geral").

---

## 4. Retirar, simplificar ou modificar

- **Retirar:**
  - A exportação por html2canvas/jsPDF e por Puppeteer. Foi a maior fonte de bugs. Deve ser substituída por uma página de relatório com CSS `@media print`, e o PDF gera-se com a impressão do browser.
  - Dependências mortas, o branding Betano e o Vercel Analytics.
  - Links sociais no rodapé, o "version modal" e a PWA com service worker que faz cache de tudo.
- **Simplificar:**
  - Uma só implementação por funcionalidade.
  - Sem monorepo: `packages/ui` está vazio e o core pode viver em `src/domain` com fronteiras claras.
  - Sem TanStack Query nem Zustand, a não ser que haja backend.
- **Modificar:**
  - Dinheiro em **cêntimos inteiros**.
  - Datas como strings ISO `AAAA-MM-DD`, sem `Date` na lógica de domínio.
  - Renomear as métricas com honestidade: "Resultado líquido (fluxo de caixa)" e "Meses positivos".
  - Import atómico com relatório por linha.
  - Tipos de transação e aliases numa única tabela.

## 5. O que falta

1. **Saldo atual por casa de apostas** (introduzido à mão, com data). Com ele o resultado passa a ser `levantado + saldo − depositado`, e só assim o "ROI" tem significado.
2. **Dimensão "casa de apostas"** por transação ou por ficheiro. O v3 tem a tabela `platforms`, mas não a usa.
3. **Gestão manual:** adicionar, editar e apagar transações; desfazer um import (lote).
4. **Import robusto:** papaparse, deteção de separador e decimal, pré-visualização com erros por linha, CSV de exemplo para descarregar e ajuda de formato.
5. **Jogo responsável:** limites de depósito mensais com alerta, visão "quanto depositei este mês e este ano", e dias desde o último depósito. É o insight mais valioso para este tipo de dados.
6. **Períodos:** comparação homóloga (ano a ano) e filtros rápidos (30 dias, 12 meses, ano civil).
7. **Backup e restauro** (JSON) e exportação CSV/XLSX dos dados filtrados, além do relatório imprimível.
8. **Acessibilidade:** tabela de dados alternativa em cada gráfico, sinais além da cor (▲▼ e sinal +/−), foco visível e navegação por teclado.
9. **Testes E2E** do fluxo import → dashboard com os teus CSVs como fixtures **locais, fora do git**.

---

## 6. Recomendação de stack e arquitetura

**Recomendo local-first, sem backend.** Os argumentos:

- O conjunto de dados é pequeno (menos de 1000 linhas por perfil), pessoal e sensível.
- Metade dos problemas críticos acima vem do Supabase: RLS por verificar, limite de 1000 linhas, chaves, auth, builds a falhar, open redirect.
- Sem servidor, os dados nunca saem do dispositivo. Também não há contas, custos, nem RGPD para gerir.

| Camada    | Escolha                                                                                                     | Nota                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Build/app | **Vite + React 19 + TypeScript strict** (SPA estática)                                                      | Next não traz nada sem servidor                                 |
| Routing   | TanStack Router (ou React Router 7)                                                                         | Rotas tipadas; filtros no URL (partilháveis e fáceis de testar) |
| Dados     | **IndexedDB via Dexie** + `useLiveQuery`                                                                    | Persistência local, reatividade e migrações de schema           |
| Domínio   | `src/domain/` com funções puras e zod nas fronteiras                                                        | Cêntimos inteiros e datas ISO                                   |
| CSV       | papaparse mais o nosso parser de números com locale                                                         | Cobre aspas, BOM e `1.234,56`                                   |
| UI        | Tailwind v4 + tokens CSS + componentes Radix (estilo shadcn)                                                | Acessíveis por omissão                                          |
| Gráficos  | Recharts 3, lazy-loaded, sempre acompanhado de uma tabela                                                   | Já conheces a biblioteca; é suficiente para este volume         |
| Relatório | Rota `/relatorio` com CSS de impressão, mais CSV/XLSX via SheetJS atual (CDN oficial) ou `write-excel-file` | Sem html2canvas                                                 |
| Qualidade | Vitest, Testing Library, Playwright, ESLint 9 flat + typescript-eslint, Prettier, CI GitHub Actions         | Todos reais e a correr                                          |
| Deploy    | Vercel ou GitHub Pages (estático)                                                                           | Sem variáveis de ambiente                                       |

**Estrutura proposta** (detalhada na fase 2):

```
src/
  domain/      money.ts dates.ts csv/ stats/ insights/   ← puro, 100% testado
  db/          schema.ts (Dexie), repos, migrations
  features/    import/ dashboard/ transactions/ profiles/ compare/ report/ settings/
  ui/          componentes base, charts/ (wrapper + tabela acessível)
  app/         routes, layout, providers
tests/e2e/     Playwright (fixtures locais ignoradas pelo git)
```

**Contrapartida:** não há sincronização entre dispositivos. Se precisares dela, a alternativa é manter o local-first e acrescentar mais tarde uma sincronização opcional encriptada (por exemplo Supabase, guardando apenas blobs encriptados no cliente). Não recomendo voltar ao modelo de "tabelas em claro com RLS".

---

## 7. Decisões que preciso de ti antes do plano

1. **Local-first sem contas** (recomendado) ou é obrigatório aceder aos dados em vários dispositivos com login?
2. **Modelo de dados:** manter só depósitos e levantamentos (mais o saldo manual por casa, recomendado)? Ou queres começar a registar apostas individuais (stake, odd, resultado)? Isto implica criares CSVs novos.
3. **Casas de apostas:** os CSVs são sempre por casa (um ficheiro = uma casa + um perfil)? Quantas casas usas?
4. **Perfis:** continuam a representar pessoas diferentes (pessoas diferentes)? Se sim, e com local-first, os dados de ambos ficam no teu dispositivo.
5. **Idioma:** só pt-PT, ou pt-PT com estrutura pronta para inglês?
6. **Relatórios:** chega um relatório imprimível (PDF pelo browser) mais CSV/XLSX, ou precisas de um PDF gerado com um design específico?
7. **Repositórios antigos:** trato de arquivar e tornar privados (só com a tua confirmação), ou fazes tu?

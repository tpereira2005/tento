# Registo de decisões

Decisões técnicas e de produto, com o contexto e as alternativas consideradas. A mais recente fica no topo.

## D-017 · Preparação do deploy público no ChatGPT Sites (2026-10-02)

- **Proteção antes da primeira conta:** `OWNER_EMAIL` opcional nas entradas Node e Worker, validado por
  `loadEnv`. O hook de criação do utilizador do Better Auth recusa outros emails com `registration_closed`,
  independentemente do fornecedor e de existirem utilizadores. Remove espaços e ignora maiúsculas.
  Mantém-se o fecho após a primeira conta e o comportamento anterior quando a variável não existe.
- **Público com dados privados:** audiência pública no Sites, sem lista de acesso. O login da aplicação
  continua a proteger a API e os dados. A ligação lógica `DB` fica no manifesto; o Sites gere o D1 real.
- **Login ChatGPT:** a [OpenAI confirma o SIWC no Sites](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt),
  mas o contrato técnico disponível (plugin Sites 0.1.75, `references/authentication.md` e
  `app/chatgpt-auth.ts` do starter) expõe um fluxo do dispatcher e cabeçalhos de identidade; não fornece
  configuração OIDC/secret para Better Auth nem prova acessível de `email_verified`. O email é descrito para
  apresentação/contacto. Não se implementa uma ligação de contas alternativa sem essas garantias;
  mantém-se email + palavra-passe. Não se alarga a CSP nem se acrescenta um botão sem login funcional.
- **Hash:** mantém-se scrypt do Better Auth. A adequação ao limite de CPU depende do teste no site real;
  se houver falha por CPU, pedir aprovação para PBKDF2 WebCrypto antes de mudar (ver MIGRACAO).
- **Build específico:** o primeiro deploy confirmou que o Sites ignorava `_headers` e o fallback de
  `wrangler.jsonc`: ativos sem CSP e endereços internos com 404. `pnpm build:sites` embute os ativos no
  Worker gerado, sem `dist/client` no pacote. `entry/sites.ts` aplica os mesmos `securityHeaders`, cache,
  tipos MIME e fallback da SPA; a API continua na entrada Worker existente. Aumenta o tamanho do Worker,
  mas garante os cabeçalhos em todas as respostas sem depender de configuração não suportada. `src/core`,
  `src/web` e repositórios da BD não mudam. O build Node/local continua independente.
- **Estado:** projeto e variáveis configurados; publicação e validação de produção pendentes.

## D-016 · Entrada Cloudflare Workers + D1 (2026-10-01)

- **Duas entradas, um só código:** `src/server/entry/node.ts` (SQLite/libSQL) e `src/server/entry/worker.ts`
  (D1, ativos estáticos do Workers) montam o mesmo `createApp`. A suíte E2E corre contra as duas
  (`pnpm e2e` e `pnpm e2e:worker`, esta com `wrangler dev`/workerd e um D1 local do Miniflare), também no CI.
- **Limite de 100 parâmetros do D1:** em vez de baixar o `INSERT` multi-linha para 9 linhas por instrução
  (centenas de consultas num import grande, acima do limite de consultas por pedido), as linhas de cada bloco
  vão num único parâmetro JSON e entram com `INSERT … SELECT … FROM json_each(?)`: 7 parâmetros por instrução,
  500 linhas por bloco, tudo no mesmo `db.batch`. Funciona igual em libSQL e D1. Escreve-se com
  ``db.insert(txn).select(sql`…`)`` e não com ``db.run(sql`…`)``: no lote do D1 o Drizzle 0.45 falha com SQL cru com
  parâmetros (`stmt` indefinido), erro que só apareceu ao correr os E2E na Worker.
- **Migrações:** os mesmos ficheiros `drizzle/*.sql`; em Node aplica-os o migrador do Drizzle, no D1 o
  `wrangler d1 migrations apply` (`migrations_dir: drizzle`). Cada lado regista as suas numa tabela própria.
- **Segredos locais da Worker:** por ficheiro (`--env-file` / `.dev.vars`, ignorados pelo git); o `--var` da
  linha de comandos substitui todas as `vars` do `wrangler.jsonc` e deixava o `BETTER_AUTH_URL` errado.
- **Cabeçalhos na Worker:** os ficheiros estáticos levam o `dist/_headers` de produção (https, com HSTS) mesmo
  no `wrangler dev` local; o E2E de segurança verifica essa variante quando corre contra a Worker.
- **Risco conhecido:** o hash scrypt do Better Auth pode passar os 10 ms de CPU do plano gratuito do Workers;
  ver docs/MIGRACAO.md.

## D-015 · Cabeçalhos de segurança e direitos sobre os dados (2026-10-01)

- **Uma só definição:** `src/server/security.ts` (sem `node:`) gera os cabeçalhos para o servidor Node (API e
  `dist/`), para o Worker e, no build, para `dist/_headers` (plugin do Vite; os ficheiros estáticos do
  Cloudflare não passam pelo Worker). HSTS e `upgrade-insecure-requests` só quando o endereço base é https.
  O servidor de desenvolvimento do Vite não leva CSP (precisa de scripts inline para o HMR).
- **CSP:** `script-src 'self' 'wasm-unsafe-eval'`: o PDF (@react-pdf) carrega o motor de layout yoga como
  WebAssembly (base64 em `fetch('data:…')`, daí `connect-src 'self' data:`); sem isso a geração falha
  (verificado no browser; os E2E falham com qualquer violação de CSP). Continua sem `unsafe-eval` nem scripts
  inline: o único inline (tema inicial) passou para `public/theme-init.js`. `style-src 'unsafe-inline'` mantém-se porque React, Radix e os gráficos
  escrevem atributos `style`; sem scripts inline o risco é baixo. `blob:` em `img-src` e `worker-src`.
- **Exportar:** `GET /api/me/export` devolve JSON versionado (`format: tento-export`, `version: 1`) com
  casas, perfis, contas, importações e transações; nunca palavras-passe, sessões nem tabelas do Better Auth.
- **Apagar dados:** `DELETE /api/me/data` com `{ "confirm": "APAGAR" }` apaga tudo o que é de domínio num
  `db.batch` atómico e mantém a conta. `DELETE /api/me` exige a palavra-passe (verificada pelo
  `deleteUser` do Better Auth) e apaga a conta; o resto cai por `ON DELETE CASCADE`. Se for o único
  utilizador, o registo volta a abrir (`countUsers = 0`): é o comportamento esperado numa instância de um dono.

## D-014 · Relatório PDF (2026-10-01)

- **Fontes:** o @react-pdf não aceita fontes variáveis nem WOFF2; o PDF embute as versões estáticas WOFF da
  Fraunces, Instrument Sans e DM Mono (subconjunto latino, que inclui o menos U+2212, o € e os acentos).
- **Espaço fino:** a DM Mono não tem o U+202F (separador de milhares) e o PDF mostrava "/"; no PDF os números
  usam o espaço inseparável U+00A0.
- **Paginação manual da tabela de transações:** a paginação automática do @react-pdf demorava ~10 s com 1000
  linhas; com páginas montadas à mão, 1000 transações desenham-se em ~1,7 s. Consequência: ao copiar texto do
  PDF, a tabela sai coluna a coluna (o texto continua selecionável e pesquisável); notas longas são cortadas.
- **Carregamento:** a biblioteca de PDF (~445 kB gzip) só carrega ao exportar; os destaques passam para o PDF
  como texto simples, sem `react-dom/server`.

## D-013 · Transações: limites conhecidos e estabilidade dos testes (2026-10-01)

- **Somas filtradas:** vêm de `/api/stats/dashboard`, que não filtra por tipo nem por texto da nota; com esses
  filtros ativos as somas seguem só perfil, casa, conta e período, e a página diz isso.
- **Editar não muda a conta** (o PATCH não aceita `walletId`): para mudar de conta apaga-se e cria-se de novo.
- **Testes da interface:** tempo das esperas assíncronas da Testing Library a 5 s e tempo por teste a 20 s; o
  painel falhava de forma intermitente com o valor por omissão (1 s) em máquinas carregadas.

## D-012 · Comparar: dois lados, mesma escala, meses alinhados por posição (2026-10-01)

- **Estado no URL:** `modo=perfis|casas|periodos`, `a`, `b` (ids; no modo períodos, `a` é `3m|6m|12m` e `b` é
  `anterior|ano`) e `periodo` partilhado. Sem `a`/`b` válidos usam-se os dois perfis (ou casas) com mais
  movimentos; o mesmo item nunca fica nos dois lados.
- **Uma consulta por lado** a `/api/stats/dashboard` (chave `['stats','compare',…]`): os números são exatamente
  os do painel.
- **Mesma escala:** as curvas acumuladas e as barras mensais usam um domínio vertical comum (`sharedYDomain`),
  senão o olho compara alturas que não são comparáveis. A é uma linha contínua com marcador redondo e B
  tracejada com marcador quadrado: distinguem-se sem a cor.
- **Perfis e casas com «tudo»:** cada lado começa no seu primeiro movimento, por isso os dois são preenchidos
  com os mesmos meses de calendário (`fillMonths`) antes de alinhar. **Períodos:** `monthlyAligned` alinha por
  posição (mês 1 com mês 1), com zeros nos meses em falta e o acumulado a manter o último valor.
- **«Período anterior»** são os mesmos meses de calendário imediatamente antes (`previousMonthsPeriod`), para as
  duas séries terem o mesmo número de meses; `previousPeriod` (em dias) fica para outros usos.
- **Diferenças honestas:** sempre `A − B`, em valor absoluto. A percentagem só aparece para depositado e
  levantado; no resultado líquido (que pode ser negativo) uma percentagem enganaria.

## D-011 · `node --watch` em vez de `tsx watch` no desenvolvimento (2026-10-01)

- **Problema:** dentro do `concurrently` (`pnpm dev`), no Windows, o `tsx watch` não arrancava a API nem
  escrevia nada (nem erros), e o Vite respondia 502 a todos os pedidos `/api`.
- **Decisão:** a API de desenvolvimento corre com `node --watch --import tsx` (Node 24); o tsx só compila.
- **Também nesta etapa:** os eixos dos gráficos usam os valores "redondos" da geometria partilhada
  (por exemplo −800…+200 no acumulado), mesmo que os mockups mostrassem −600…+200: a geometria é a mesma
  no ecrã e no PDF e não se ajusta à mão.

## D-010 · Estrutura da aplicação e E2E contra o servidor real (2026-10-01)

- **Sessão no router:** o layout `_app` carrega `GET /api/me` em `beforeLoad` (cache do TanStack Query, chave `['me']`) e redireciona para `/entrar?redirect=…` num 401. O destino só é aceite se for um caminho interno (`safeRedirect`). Ao entrar aplica-se o tema guardado na conta; no arranque só se aplica se o navegador não tiver escolha local, para não perder uma mudança ainda por gravar.
- **Navegação:** barra superior a partir de 768 px (a ligação "Definições" sai da barra abaixo de 1024 px e fica no menu da conta); separadores em baixo e painel "Mais" abaixo de 768 px. O menu da conta é um painel simples (botão com `aria-expanded`), não um `role="menu"`.
- **E2E:** `scripts/e2e-server.mjs` faz `pnpm build` e corre o servidor de produção real em :4173 com uma base de dados nova (`data/e2e.db`) e um segredo aleatório. O projeto `setup` regista o dono pela interface com credenciais fictícias geradas no momento (`tests/e2e/.auth/`, ignorado pelo git) e os projetos `desktop` e `movel` partilham essa sessão. Como a base de dados é única, `workers: 1`; testes que terminam a sessão fazem o seu próprio início de sessão.

## D-009 · Escritas atómicas com batch e proteção CSRF por origem (2026-10-01)

- **Batch em vez de transação:** as escritas com várias instruções (importar, desfazer) usam `db.batch([...])`,
  que o libSQL e o D1 suportam; o D1 não tem transações interativas. As inserções vão em blocos de
  `INSERT_CHUNK_ROWS` linhas (200 no libSQL). **Pendente para a etapa 8:** o D1 aceita no máximo 100
  parâmetros por instrução, por isso o bloco tem de descer para 9 linhas nesse adaptador.
- **CSRF:** qualquer POST, PATCH ou DELETE tem de trazer `Origin` igual a `BETTER_AUTH_URL`; o `csrf()` do
  Hono só verifica formulários, por isso a verificação é própria.
- **Registo:** fecha quando já existe um utilizador. A verificação não é atómica (dois registos simultâneos
  no primeiro arranque poderiam passar), o que é aceitável numa aplicação privada de um só dono.

## D-008 · Repositório público, recriado com histórico limpo (2026-09-30)

- **Contexto:** o GitHub Actions deixou de correr no repositório privado (pagamento da conta falhado).
- **Decisão:** tornar o repositório público. Antes disso, o repositório (com 1 hora) foi apagado e recriado
  com um histórico novo, sem nomes reais nem detalhes dos CSVs verdadeiros.
- **Consequências:** os dados de exemplo usam perfis fictícios («Ana», «Rui»); a deteção de segredos com
  bloqueio no push e os alertas do Dependabot ficam ativos; merges feitos pelo agente com o CI verde.

## D-007 · TypeScript 6.0 e ESLint 9 em vez das versões mais recentes (2026-09-30)

- **Contexto:** em setembro de 2026 as últimas versões são TypeScript 7.0 (reescrito em Go) e ESLint 10.
- **Decisão:** fixar `typescript@6.0.x` e `eslint@9.x` (com `@eslint/js` igual).
- **Porquê:** o `typescript-eslint` só suporta TypeScript `< 6.1`; o TypeScript 7 ainda não expõe a API usada
  pelo lint com tipos. O `eslint-plugin-jsx-a11y` só suporta até ao ESLint 9, e o lint de acessibilidade é
  obrigatório.
- **Revisão:** o Dependabot abre PRs de atualização; subir quando os plugins suportarem as novas versões.

## D-006 · Nome e marca: Tento (2026-09-30)

«Tento» é a ficha com que se contam os pontos de um jogo, e «ter tento» é ter juízo. Não tem acentos (o
repositório e o URL coincidem com o nome) e o símbolo (uma ficha sobre a linha do zero) lê-se a 16 px.
Alternativas avaliadas: Prumo, Razão, Balanço.

## D-005 · Identidade visual: direção G com tipografia T2 (2026-09-30)

Cores «Balanço» (papel, tinta, cobalto, coral/carmim), layout final G, temas claro e escuro com o mesmo
layout. Tipografia: Fraunces (títulos e números de destaque), Instrument Sans (interface), DM Mono
(tabelas e rótulos). Fontes alojadas localmente (Fontsource), sem pedidos a terceiros.
Referência: `docs/design/`.

## D-004 · SQLite (Drizzle) e Hono para não ficar preso a um fornecedor (2026-09-30)

O alojamento final previsto é o ChatGPT Sites (Cloudflare Workers + D1/SQLite, sem Postgres). SQLite com
Drizzle funciona como ficheiro local, D1 ou Turso; Hono corre em Node e Workers sem alterações. A migração
faz-se trocando o adaptador da base de dados e o ponto de entrada (`docs/MIGRACAO.md`, etapa 8).

## D-003 · PDF com @react-pdf/renderer, gerado no browser (2026-09-30)

Vetorial, com as fontes da marca embutidas, e carregado só ao exportar. O html2canvas/jsPDF e o Puppeteer
do v1 foram a maior fonte de bugs, e o Puppeteer não corre em Workers.

## D-002 · Dinheiro em cêntimos e datas como texto ISO (2026-09-30)

As versões anteriores tinham erros de arredondamento (`1.234,56` → `1.23`) e de fuso horário (o dia 1 do
mês a passar para o mês anterior). Valores em cêntimos inteiros e datas `AAAA-MM-DD` eliminam as duas
classes de erros.

## D-001 · Recomeçar do zero (2026-09-30)

A análise dos três repositórios anteriores (`docs/historico/RELATORIO-ANALISE.md`) encontrou importação
partida, truncagem silenciosa a 1000 linhas, dados reais publicados e métricas enganadoras. Reaproveitam-se
ideias (diff multiset, aliases de cabeçalhos, comparação de perfis), não código.

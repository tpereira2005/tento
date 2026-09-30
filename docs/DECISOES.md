# Registo de decisões

Decisões técnicas e de produto, com o contexto e as alternativas consideradas. A mais recente fica no topo.

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

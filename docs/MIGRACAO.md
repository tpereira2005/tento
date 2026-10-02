# Migração para Cloudflare Workers + D1 (ChatGPT Sites)

Guia para quem fizer o alojamento final (o dono ou um agente de código como o Codex). O Tento já corre
nas duas entradas, com o mesmo código de domínio, API e interface:

| Entrada | Ficheiro                     | Base de dados                  | Ficheiros estáticos                      |
| ------- | ---------------------------- | ------------------------------ | ---------------------------------------- |
| Node    | `src/server/entry/node.ts`   | SQLite/libSQL (`DATABASE_URL`) | `dist/` servido pelo Hono                |
| Worker  | `src/server/entry/worker.ts` | D1 (ligação `DB`)              | Workers Static Assets (ligação `ASSETS`) |

A suíte E2E completa corre contra as duas (`pnpm e2e` e `pnpm e2e:worker`), também no CI. Se as duas
passarem, a migração é só configuração: **não é preciso mudar código em `src/core`, `src/web` nem nos
repositórios**.

## O que já está preparado

- `wrangler.jsonc`: entrada, `nodejs_compat`, ativos de `dist/` com `run_worker_first: ["/api/*"]` e
  fallback de SPA, ligação D1 com as migrações em `drizzle/`.
- `dist/_headers`: os cabeçalhos de segurança (CSP, HSTS, `frame-ancestors`…) gerados no build a partir da
  mesma definição que a entrada Node usa, porque os ficheiros estáticos não passam pelo Worker.
- Escritas atómicas só com `db.batch([...])` (o D1 não tem transações interativas).
- Inserção das linhas de um CSV com um único parâmetro JSON por bloco (`json_each`), o que respeita o limite
  de 100 parâmetros por consulta do D1 e mantém poucas consultas por pedido (ver D-016).

## Passos (Cloudflare Workers)

Com a conta Cloudflare do dono e o `wrangler` já instalado (`pnpm install`):

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create tento
```

1. Copia o `database_id` devolvido para `d1_databases[0].database_id` em `wrangler.jsonc`.
2. Em `vars.BETTER_AUTH_URL` põe o endereço público final, com `https://` e sem barra no fim
   (ex.: `https://tento.exemplo.pt`). Tem de ser exatamente a origem que o browser vê: a proteção CSRF e os
   cookies dependem disso.
3. Aplica as migrações e define o segredo (o valor nunca vai para o repositório):

```bash
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

4. Compila e publica:

```bash
pnpm build
pnpm exec wrangler deploy
```

5. Abre o endereço, cria a conta do dono (o registo fecha logo a seguir) e importa os CSVs.

## ChatGPT Sites

O ChatGPT Sites corre sobre Workers + D1, por isso o plano é o mesmo. O que pode variar e onde mexer:

| Se o ChatGPT Sites…                   | Muda                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| dá outro nome à ligação D1            | o campo `DB` em `WorkerEnv` (`worker.ts`) e o `binding` em `wrangler.jsonc`              |
| serve os estáticos de outra forma     | o bloco `assets`; garante que `/api/*` chega ao Worker e que o resto cai no `index.html` |
| não lê `_headers`                     | aplica `securityHeaders` também às respostas de ativos (ou configura-os na plataforma)   |
| tem a sua própria gestão de migrações | aplica os ficheiros de `drizzle/*.sql` por ordem; são SQL de SQLite simples              |
| oferece «Sign in with ChatGPT» (OIDC) | opcional: acrescenta um fornecedor social/OIDC no Better Auth (`src/server/auth.ts`)     |

Variáveis obrigatórias em qualquer caso: `BETTER_AUTH_SECRET` (segredo, ≥ 32 caracteres) e
`BETTER_AUTH_URL` (origem pública).

## Configuração do Tento no Sites

- Projeto registado em `.openai/hosting.json`, com a ligação lógica `d1: "DB"`. O Sites gere o recurso
  D1 real; o `database_id` de `wrangler.jsonc` continua a ser o marcador para desenvolvimento local.
- Origem prevista: `https://tento.tomaspereira.chatgpt.site`. A publicação e a verificação em produção
  ainda estão pendentes; o projeto foi configurado com acesso **público**, sem lista de visitantes.
- Variáveis de runtime nas definições do Sites: `BETTER_AUTH_URL` igual à origem acima, sem barra final;
  `OWNER_EMAIL` igual ao email do dono; `BETTER_AUTH_SECRET` marcado como segredo da plataforma.
- `OWNER_EMAIL` é opcional. Se estiver definido, o hook de criação do utilizador do Better Auth recusa
  qualquer outro email com `registration_closed`, mesmo com zero utilizadores e em qualquer fornecedor.
  A comparação remove espaços e ignora maiúsculas. Sem esta variável mantém-se o comportamento anterior.
  Depois da primeira conta, o registo continua fechado. Apagar essa conta volta a permitir apenas o dono.
- `pnpm build:sites` compila a SPA em `dist/client/`, incluindo `_headers`, e empacota a entrada Worker
  existente em `dist/server/index.js` com `nodejs_compat`. Copia o manifesto e as migrações para
  `dist/.openai/`. O build local/Node (`pnpm build`) mantém o formato anterior.
- O Sites aplica e regista individualmente os SQL de `drizzle/` antes de carregar o Worker.
  Não aplicar migrações no arranque nem modificar migrações já publicadas.

### Autenticação verificada na plataforma

A [documentação oficial](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt) confirma
«Sign in with ChatGPT» no Sites. O contrato técnico do plugin Sites 0.1.75 descreve um fluxo gerido pelo
dispatcher (`/signin-with-chatgpt`, `/callback` e cabeçalhos `oai-authenticated-user-*`), e não um
fornecedor OIDC com client secret disponível para configurar no Better Auth. O email é descrito para
apresentação/contacto, sem um claim `email_verified` acessível. Assim, **o Tento mantém apenas email e
palavra-passe**: não liga contas por cabeçalhos nem inventa um fornecedor. Rever quando existir um contrato
documentado que cumpra a verificação de email e a ligação segura de contas (D-017). A CSP não foi alargada.

### Voltar a publicar e rodar os segredos

1. Trabalhar num ramo próprio, preservar `.openai/hosting.json` e gerar migrações novas com
   `pnpm db:generate` se o esquema mudar. Rever o SQL; nunca reescrever migrações aplicadas.
2. Correr `pnpm check`, `pnpm e2e:worker` e `pnpm build:sites`.
3. Usar o fluxo de publicação da skill Sites com o mesmo projeto: enviar o commit exato para o repositório
   de origem do Sites, empacotar `dist/`, guardar a versão e publicar para a audiência pública existente.
   O repositório de origem do Sites é distinto do GitHub; não usar `wrangler deploy` para atualizar o Sites.
4. Esperar pelo estado de publicação concluída e testar a origem pública com dados fictícios.
5. Para rodar `BETTER_AUTH_SECRET`, substituir apenas esse segredo nas definições do Sites e publicar
   novamente uma versão guardada. As sessões existentes deixam de ser válidas; as palavras-passe e os dados
   mantêm-se. Nunca copiar segredos para o manifesto, GitHub, chat ou notas de release.
6. Se mudar o domínio, alterar `BETTER_AUTH_URL` para a origem exata do browser e voltar a publicar.

## Limites a conhecer

- **CPU por pedido:** o Better Auth guarda as palavras-passe com scrypt, que gasta CPU de propósito. No plano
  gratuito do Workers (10 ms de CPU por pedido) o login pode falhar com «exceeded CPU time». No plano pago
  (por omissão 30 s) não há problema. Se o alojamento tiver um limite baixo, troca o hash em
  `emailAndPassword.password` por PBKDF2 da WebCrypto, e regista a decisão (obriga a redefinir a palavra-passe).
- **Consultas por pedido:** um import faz poucas consultas (1 + uma por cada 500 linhas, dentro de um único
  lote). O relatório PDF lê as transações em páginas de 200, com um pedido por página.
- **Tamanho do pedido:** os imports aceitam até 5 MB (`IMPORT_LIMIT` em `src/server/app.ts`), abaixo dos
  limites do Workers.

## Levar os dados de uma instalação Node para o D1

Os dados de domínio (perfis, casas, contas, imports, transações, definições) e a conta vivem nas mesmas tabelas
nas duas entradas. Para copiar uma base `data/tento.db` existente:

```bash
pnpm exec wrangler d1 migrations apply DB --remote
sqlite3 data/tento.db ".dump --data-only" | grep -v "__drizzle_migrations" > dados.sql
pnpm exec wrangler d1 execute DB --remote --file dados.sql
```

Apaga `dados.sql` a seguir: tem os teus dados reais e nunca entra no repositório. Em alternativa, cria a conta
de raiz no novo alojamento e volta a importar os CSVs (a deteção de duplicados torna isto seguro).

## Verificação local antes de publicar

```bash
pnpm e2e:worker
```

Compila, cria um D1 local novo em `data/e2e-worker/` (Miniflare), aplica as migrações e corre a suíte E2E
inteira contra o `wrangler dev`. Para usar a app à mão sobre a Worker, cria `.dev.vars` (ignorado pelo git)
com `BETTER_AUTH_SECRET=...` e `BETTER_AUTH_URL=http://localhost:8787`, e corre `pnpm worker:dev`.

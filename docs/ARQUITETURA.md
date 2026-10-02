# Arquitetura

## Visão geral

```
┌──────────────── browser ────────────────┐        ┌──────────── servidor ────────────┐
│ src/web  (React, TanStack Router/Query) │  HTTP  │ src/server (Hono)                │
│   ui/ charts/ features/ pdf/ i18n/      │ ─────► │   routes/ → repos/ (userId)      │
│              │                          │  JSON  │   auth (Better Auth)             │
│              ▼                          │        │   db/ (Drizzle, SQLite)          │
│        src/core (domínio puro) ◄────────┼────────┤        │                         │
└─────────────────────────────────────────┘        └────────┼─────────────────────────┘
                                                             ▼
                                        ficheiro SQLite (dev) · D1 (Workers/Sites) · Turso
```

- **`src/core`** é o coração: parsing de CSV, dinheiro, datas, estatísticas, destaques e geometria dos
  gráficos. É partilhado pelo servidor (cálculos), pela interface (gráficos) e pelo PDF (mesma geometria).
  Não faz I/O e está coberto a ≥ 95 %.
- **`src/server`** expõe uma API JSON. Cada rota valida a entrada com zod e só acede aos dados através de
  repositórios que exigem `userId`. Há duas entradas: `entry/node.ts` (desenvolvimento, Docker) e
  `entry/worker.ts` (Cloudflare Workers / ChatGPT Sites).
- **`src/web`** é uma SPA estática. Os filtros (perfil, casa, período) vivem no URL.

## Módulos de `src/core`

| Módulo      | Responsabilidade       | Funções principais                                                                                           |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `types.ts`  | tipos partilhados      | `Transaction`, `WalletRef`, `IsoDate`, `MonthKey`, `Result`, `netEffect`                                     |
| `money.ts`  | montantes em cêntimos  | `parseAmount` (pt/en, milhares, sinais), `detectDecimalHint`                                                 |
| `dates.ts`  | datas ISO em UTC       | `parseDate`, `monthRange`, `addDays`, `isoWeekday`                                                           |
| `format.ts` | apresentação pt-PT     | `formatCents`, `formatPercent`                                                                               |
| `csv/`      | importação             | `parseTransactionsCsv` (aliases, separador, BOM, erros por linha), `diffTransactions` (multiset + conflitos) |
| `stats/`    | estatísticas           | `summarize`, `monthlySeries`, `computeStreaks`, `depositHeatmap`, `breakdown`, `comparePeriods`              |
| `insights/` | destaques              | `generateInsights` → `{ id, tone, priority, params }` (o texto vem do i18n da web)                           |
| `charts/`   | geometria dos gráficos | `cumulativeLine` (monótona), `signedBars`, `calendarGrid`, `niceTicks`                                       |

## Modelo de dados

Ver `docs/PLANO.md` §4. Resumo: `bookmaker` (casa), `profile` (perfil), `wallet` (conta = perfil × casa),
`import_batch` e `txn` (transação, `amount_cents` inteiro, `date` ISO), mais as tabelas do Better Auth.

## Portabilidade

| Peça          | Local                               | Cloudflare / ChatGPT Sites                       | Outro alojamento |
| ------------- | ----------------------------------- | ------------------------------------------------ | ---------------- |
| Frontend      | Vite dev / `vite preview`           | ativos estáticos do Worker                       | qualquer CDN     |
| API           | Hono em Node                        | Hono em Workers                                  | Node, Bun, Deno  |
| Base de dados | ficheiro SQLite                     | D1                                               | Turso / libSQL   |
| Autenticação  | Better Auth (email + palavra-passe) | Better Auth (email + palavra-passe; OWNER_EMAIL) | idem             |

Entradas: `src/server/entry/node.ts` (Node + SQLite) e `src/server/entry/worker.ts` (Workers + D1), com o
mesmo `createApp`. Passos e limites para o alojamento final em [`MIGRACAO.md`](MIGRACAO.md); decisão em D-016.

O projeto do ChatGPT Sites está configurado em `.openai/hosting.json` com D1 `DB` e acesso público;
publicação e validação em produção ainda pendentes. A limitação da integração SIWC está registada em D-017.

## API (`/api`)

Todas as rotas exceto `/auth/*` e `/setup` exigem sessão. Pedidos que alteram dados exigem o cabeçalho
`Origin` igual a `BETTER_AUTH_URL` (proteção CSRF). Erros: `{ error: { code, message, details? } }`.

| Rota                                     | Faz                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `/auth/*`                                | Better Auth (email e palavra-passe; registo fecha após o primeiro utilizador)         |
| `GET /setup`                             | `{ registrationOpen }`                                                                |
| `GET /me`, `PATCH /me/settings`          | utilizador e preferências                                                             |
| `GET /me/export`                         | descarrega todos os dados do utilizador em JSON (`tento-dados-AAAA-MM-DD.json`)       |
| `DELETE /me/data`                        | apaga todos os dados (corpo `{ "confirm": "APAGAR" }`); a conta mantém-se             |
| `DELETE /me`                             | apaga a conta e tudo (corpo `{ "password" }`); termina a sessão                       |
| `/bookmakers`, `/profiles`, `/wallets`   | casas, perfis e contas (listar, criar, renomear, apagar)                              |
| `POST /imports/preview`, `POST /imports` | pré-visualizar e importar um CSV (lido e comparado sempre no servidor)                |
| `GET /imports`, `POST /imports/:id/undo` | histórico e desfazer um import                                                        |
| `/transactions`                          | página com filtros (keyset), criar, editar e apagar à mão                             |
| `GET /stats/dashboard`                   | resumo, séries, sequências, mapa, repartições e destaques (calculados com `src/core`) |

Todas as respostas levam cabeçalhos de segurança (CSP, HSTS em https, `frame-ancestors 'none'`…), definidos em
`src/server/security.ts`; o build emite também `dist/_headers` com os mesmos valores.

Desenvolvimento: `pnpm dev` arranca o Vite (5173) e a API (8787); o Vite encaminha `/api` para a API.

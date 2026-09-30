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

| Peça          | Local                               | Cloudflare / ChatGPT Sites            | Outro alojamento |
| ------------- | ----------------------------------- | ------------------------------------- | ---------------- |
| Frontend      | Vite dev / `vite preview`           | ativos estáticos do Worker            | qualquer CDN     |
| API           | Hono em Node                        | Hono em Workers                       | Node, Bun, Deno  |
| Base de dados | ficheiro SQLite                     | D1                                    | Turso / libSQL   |
| Autenticação  | Better Auth (email + palavra-passe) | idem, + «Sign in with ChatGPT» (OIDC) | idem             |

Esta secção é completada na etapa 2 (API) e na etapa 8 (migração).

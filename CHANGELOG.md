# Changelog

Todas as alterações relevantes do Tento. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-PT/1.1.0/)
e as versões seguem [SemVer](https://semver.org/lang/pt-PT/).

## [1.1.0] — por publicar

- Proteção opcional do registo com `OWNER_EMAIL`: outros emails são recusados mesmo com a base vazia.
- Configuração do projeto ChatGPT Sites com D1 `DB`, audiência pública e segredos na plataforma.
- `pnpm build:sites` empacota a entrada Worker existente, a SPA, os cabeçalhos e as migrações.
- Documentação da integração ChatGPT: o contrato atual não fornece o fornecedor OIDC/email verificado
  necessário para ligar contas no Better Auth; mantém-se email + palavra-passe.
- Publicação e verificação em produção pendentes.

## [1.0.0] — 2026-10-02

Primeira versão completa: as 9 etapas do [plano](docs/PLANO.md).

### Etapa 8 — Endurecimento e portabilidade

- Cabeçalhos de segurança em todas as respostas: CSP sem scripts inline, HSTS (em https),
  `frame-ancestors 'none'`, `Permissions-Policy`; `dist/_headers` gerado no build para o Cloudflare.
- Exportar todos os dados em JSON, apagar todos os dados (mantendo a conta) e apagar a conta, em Definições.
- Entrada Cloudflare Workers + D1 (`src/server/entry/worker.ts`, `wrangler.jsonc`), com a suíte E2E inteira a
  correr também em workerd com D1 local; guia [`docs/MIGRACAO.md`](docs/MIGRACAO.md) para o ChatGPT Sites.
- Imports compatíveis com os limites do D1: as linhas entram com um parâmetro JSON por bloco (`json_each`).

### Etapa 7 — Relatório PDF ([#14](https://github.com/tpereira2005/tento/pull/14))

- Relatório de 4 secções (capa, evolução, repartições e destaques, transações) com o design da marca,
  gerado no browser e carregado só quando é pedido.
- Página Relatórios com âmbito perfil · casa · período; «Exportar PDF» no Painel.

### Etapa 6 — Transações e Comparar ([#13](https://github.com/tpereira2005/tento/pull/13))

- Tabela de transações com filtros no URL, paginação por cursor, edição de notas e movimentos manuais.
- Comparar perfis, casas e períodos (incluindo o mesmo período do ano anterior).

### Etapa 5 — Painel ([#12](https://github.com/tpereira2005/tento/pull/12))

- KPIs, curva do acumulado, resultado mensal, mapa de calor, repartições e destaques automáticos.

### Etapa 4 — Importação ([#11](https://github.com/tpereira2005/tento/pull/11))

- Assistente de importação de CSV com pré-visualização, deteção de duplicados e conflitos, histórico e
  anular import.

### Etapa 3 — Estrutura da aplicação e definições ([#10](https://github.com/tpereira2005/tento/pull/10))

- Navegação, tema claro/escuro, idioma, gestão de perfis, casas e contas.

### Etapa 2 — Base de dados, API e autenticação ([#9](https://github.com/tpereira2005/tento/pull/9))

- API Hono sobre SQLite (Drizzle), Better Auth com email e palavra-passe, registo fechado após o dono.

### Etapa 1 — Núcleo de domínio ([#7](https://github.com/tpereira2005/tento/pull/7))

- Dinheiro em cêntimos, datas ISO, leitor de CSV, estatísticas, destaques e geometria dos gráficos.

### Etapa 0 — Fundações ([#1](https://github.com/tpereira2005/tento/pull/1))

- Repositório, CI, guardas de dados reais, identidade visual e documentação.

[1.0.0]: https://github.com/tpereira2005/tento/releases/tag/v1.0.0

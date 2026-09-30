# AGENTS.md

Instruções para agentes de código (Claude, Codex, etc.) e pessoas que trabalhem neste repositório.
Lê este ficheiro inteiro antes de alterar código. Se uma regra aqui entrar em conflito com um pedido, pergunta.

## O que é o Tento

Aplicação web privada que analisa o **fluxo de caixa** das contas do dono nas casas de apostas:
depósitos, levantamentos e resultado líquido (`levantado − depositado`), por **casa**, **perfil** e **conta**
(conta = perfil × casa). Os dados entram por ficheiros CSV feitos à mão, um por conta.

Não há apostas individuais, odds nem saldo manual. As métricas têm de ser honestas: diz-se "resultado líquido"
e "meses positivos", nunca "ROI" ou "win rate".

- Plano e etapas: [`docs/PLANO.md`](docs/PLANO.md)
- Arquitetura: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Decisões e porquês: [`docs/DECISOES.md`](docs/DECISOES.md)
- Referência visual: [`docs/design/`](docs/design) (pranchas da direção final e mockups HTML)

## Estado atual

Etapa **0 — Fundações** (ver a tabela de etapas no README). Atualiza esta linha no fim de cada etapa.

## Comandos

```bash
pnpm install          # instala dependências e os hooks de git (lefthook)
pnpm dev              # servidor de desenvolvimento em http://localhost:5173
pnpm check            # lint + typecheck + formato + testes + build (corre antes de abrir um PR)
pnpm test             # testes unitários e de componentes (Vitest)
pnpm test:coverage    # com cobertura
pnpm e2e              # testes de ponta a ponta com Playwright e axe (faz build e serve em :4173)
pnpm format           # formata tudo com Prettier
pnpm brand            # regenera logótipo, ícones e favicon a partir de scripts/brand.mjs
```

Requisitos: Node 24 (`.nvmrc`), pnpm 10 (`packageManager` no `package.json`).

## Estrutura e fronteiras

```
src/core/     domínio puro: dinheiro, datas, CSV, estatísticas, destaques, geometria dos gráficos
src/server/   API Hono, autenticação, base de dados (a partir da etapa 2)
src/web/      aplicação React: routes/, features/, ui/, charts/, pdf/, i18n/, styles/
tests/e2e/    Playwright
tests/fixtures/  CSVs SINTÉTICOS (nunca dados reais)
scripts/      utilitários (marca, guardas de git)
docs/         documentação
brand/        logótipo e ícones gerados
```

Regras garantidas pelo ESLint (`no-restricted-imports`):

- `src/core` não importa `src/web`, `src/server` nem React. Não faz I/O.
- `src/web` não importa `src/server`; fala com a API por HTTP.

## Convenções de código

- **TypeScript strict**, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Proibido `any`
  e `@ts-ignore`. `eslint-disable` só com justificação na mesma linha.
- **Dinheiro em cêntimos inteiros** (`number` inteiro seguro). Nunca `float` para valores. Formatação só com
  `formatCents` de `src/core/format.ts`.
- **Datas como texto ISO `AAAA-MM-DD`.** Nada de `new Date('2025-01-01')` nem `getMonth()` no domínio
  (há bugs de fuso horário nas versões antigas). Meses como `AAAA-MM`.
- **Identificadores em inglês**, comentários e documentação em **pt-PT**.
- **Textos da interface só em `src/web/i18n/pt-PT.ts`**, com as mesmas chaves em `en.ts`. Não escrevas texto
  de interface diretamente nos componentes (exceção: a página de desenvolvimento `/componentes`).
- **Cores só por tokens** (`bg-surface`, `text-ink-2`, `text-neg-text`…, definidos em
  `src/web/styles/app.css`). Proibido hex nos componentes.
- **Positivo e negativo** diferem em claridade e levam sempre sinal (`+`/`−`, com o menos tipográfico U+2212)
  e/ou triângulo ▲▼. Nunca só a cor.
- Componentes base em `src/web/ui/` (exportados por `index.ts`). Antes de criar um componente novo, procura lá.
- Tipografia: títulos e números de destaque em Fraunces (`font-display`), interface em Instrument Sans
  (`font-sans`), números em tabelas e rótulos em DM Mono (`.num`, `.eyebrow`).
- Ficheiros com mais de ~300 linhas são sinal para dividir.

## Acessibilidade (obrigatória)

WCAG 2.2 AA. Botões e links reais, `label` em todos os campos, foco visível, navegação completa por teclado,
zoom nunca bloqueado, `prefers-reduced-motion` respeitado. Cada gráfico tem `aria-label` e uma alternativa
em tabela. Os testes E2E correm o axe e falham com qualquer violação.

## Dados reais — regra absoluta

- **Nenhum CSV, folha de cálculo ou base de dados real entra no repositório**, nos testes do CI, em
  capturas de ecrã nem em artefactos publicados. O `.gitignore` e o hook `scripts/guard-data-files.mjs`
  bloqueiam-nos; não os contornes.
- CSVs de teste são sintéticos e vivem em `tests/fixtures/`.
- Para validar com os ficheiros reais localmente, lê-os de uma pasta fora do repositório indicada pela variável
  `TENTO_REAL_CSV_DIR`; esses testes são ignorados quando a variável não existe.
- Sem analytics, sem fontes ou scripts de terceiros em runtime.

## Segurança

- Todas as consultas à base de dados passam pelos repositórios de `src/server/db/repos`, que exigem `userId`.
  Qualquer rota nova precisa de um teste que prove que outro utilizador não lhe acede.
- Validação com zod em todas as entradas da API. Segredos só em variáveis de ambiente (`.env` está no
  `.gitignore`; documenta as chaves em `.env.example`).
- O registo público fecha depois de criado o primeiro utilizador.

## Git e GitHub

- Ramo por etapa: `etapa/<n>-<nome>` (ex.: `etapa/1-dominio`). Nada é enviado diretamente para `main`.
- Commits no formato Conventional Commits, com descrição em pt-PT: `feat(importar): pré-visualização com
conflitos`. O hook `commit-msg` valida o formato.
- Um PR por etapa, com o template preenchido (âmbito, checklist de "concluído", capturas antes/depois).
  O dono delegou os merges: o agente faz o merge (squash) **só** com o CI verde e depois de verificar os
  critérios de "concluído" da etapa. Nunca se contorna a proteção do `main`.
- Etiquetas: `etapa:N`, `tipo:*`, `prioridade:P0–P2`. Cada etapa tem um milestone.

## Definição de "concluído" (para qualquer tarefa)

1. `pnpm check` passa localmente e o CI está verde.
2. Há testes para o comportamento novo (unitários no `core`, de componente na `web`, E2E para fluxos).
3. Alterações visuais foram vistas em claro, escuro e a 390 px, e comparadas com `docs/design/`.
4. `docs/` e este ficheiro estão atualizados se a mudança alterou regras, estrutura ou comandos.
5. Decisões técnicas não óbvias ficam registadas em `docs/DECISOES.md`.

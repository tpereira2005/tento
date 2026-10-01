// Servidor para os testes E2E: compila a aplicação e corre o servidor REAL de produção
// (API + ficheiros de dist/) com uma base de dados nova e um segredo aleatório.
// Uso: node scripts/e2e-server.mjs   (o Playwright arranca-o; ver playwright.config.ts)
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { register } from 'tsx/esm/api';
import { pathToFileURL } from 'node:url';

const PORT = '4173';
const DB_FILE = './data/e2e.db';

mkdirSync('./data', { recursive: true });
for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${DB_FILE}${suffix}`, { force: true });

const build = spawnSync('pnpm build', { stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

process.env.NODE_ENV = 'production';
process.env.PORT = PORT;
process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');

// O servidor corre neste processo (sem processos filhos que possam ficar órfãos ao terminar).
register();
await import(pathToFileURL('./src/server/entry/node.ts').href);

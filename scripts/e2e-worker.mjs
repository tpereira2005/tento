// Servidor para os testes E2E contra a entrada Cloudflare Workers: compila a aplicação, aplica as migrações
// num D1 local novo (Miniflare) e corre `wrangler dev` (workerd) na mesma porta da entrada Node.
// Uso: TENTO_E2E_TARGET=worker pnpm e2e   (o Playwright arranca-o; ver playwright.config.ts)
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const PORT = '4173';
const STATE = './data/e2e-worker';
const ORIGIN = `http://localhost:${PORT}`;

rmSync(STATE, { recursive: true, force: true });
mkdirSync(STATE, { recursive: true });

function run(command) {
  const r = spawnSync(command, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('pnpm build');
run(`pnpm exec wrangler d1 migrations apply DB --local --persist-to ${STATE}`);

// Segredo aleatório num ficheiro (nunca na linha de comandos: o `--var` substituiria as `vars` do wrangler.jsonc).
const envFile = `${STATE}/.dev.vars`;
writeFileSync(envFile, `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nBETTER_AUTH_URL=${ORIGIN}\n`);

const child = spawn(
  `pnpm exec wrangler dev --port ${PORT} --persist-to ${STATE} --env-file ${envFile} --log-level warn --show-interactive-dev-session=false`,
  { stdio: 'inherit', shell: true },
);
const stop = () => {
  // No Windows o `kill` não chega aos netos (workerd): termina a árvore inteira.
  if (process.platform === 'win32') spawnSync(`taskkill /pid ${String(child.pid)} /T /F`, { shell: true });
  else child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
child.on('exit', (code) => process.exit(code ?? 0));

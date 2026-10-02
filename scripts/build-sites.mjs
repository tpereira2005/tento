// Empacota a entrada Worker existente para o contrato do Sites, sem alterar o build Node/local.
import { spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'dist');
// O único alvo apagado é o diretório de build dentro deste repositório.
if (
  dirname(output) !== root ||
  basename(output) !== 'dist' ||
  lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()
) {
  throw new Error('Diretório de build inesperado.');
}
rmSync(output, { recursive: true, force: true });

function run(module, args) {
  const result = spawnSync(process.execPath, [resolve(root, module), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('node_modules/vite/bin/vite.js', ['build', '--outDir', 'dist/client']);
run('node_modules/wrangler/bin/wrangler.js', [
  'deploy',
  '--dry-run',
  '--outdir',
  'dist/server',
  '--assets',
  'dist/client',
]);
renameSync(resolve(output, 'server/worker.js'), resolve(output, 'server/index.js'));
mkdirSync(resolve(output, '.openai'), { recursive: true });
cpSync(resolve(root, '.openai/hosting.json'), resolve(output, '.openai/hosting.json'));
cpSync(resolve(root, 'drizzle'), resolve(output, '.openai/drizzle'), { recursive: true });

// O Sites substitui os recursos lógicos pelos recursos reais da plataforma; não há id D1 de produção.
writeFileSync(
  resolve(output, 'server/wrangler.json'),
  JSON.stringify(
    {
      name: 'tento',
      main: './index.js',
      compatibility_date: '2026-09-30',
      compatibility_flags: ['nodejs_compat'],
      assets: {
        directory: '../client',
        binding: 'ASSETS',
        not_found_handling: 'single-page-application',
        run_worker_first: ['/api/*'],
      },
    },
    null,
    2,
  ) + '\n',
);

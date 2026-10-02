// Empacota a entrada Worker existente para o contrato do Sites, sem alterar o build Node/local.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
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

// Sem dist/client no pacote: o Sites serviria esses ficheiros antes do Worker, sem `_headers`.
const client = resolve(root, '.wrangler/sites-client');
mkdirSync(resolve(root, '.wrangler'), { recursive: true });
run('node_modules/vite/bin/vite.js', ['build', '--outDir', '.wrangler/sites-client', '--emptyOutDir']);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const assets = {};
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) collect(filename);
    else if (entry.isFile() && entry.name !== '_headers') {
      const bytes = readFileSync(filename);
      const pathname = '/' + relative(client, filename).replaceAll('\\', '/');
      assets[pathname] = {
        base64: bytes.toString('base64'),
        contentType: contentTypes[extname(filename)] ?? 'application/octet-stream',
        etag: '"' + createHash('sha256').update(bytes).digest('hex') + '"',
      };
    } else if (!entry.isFile()) throw new Error('Ativo inesperado no build.');
  }
}
collect(client);
writeFileSync(resolve(root, '.wrangler/sites-assets.json'), JSON.stringify(assets));
writeFileSync(
  resolve(root, '.wrangler/sites-entry.mjs'),
  "import { createSitesWorker } from '../src/server/entry/sites.ts';\n" +
    "import assets from './sites-assets.json';\nexport default createSitesWorker(assets);\n",
);
const config = {
  name: 'tento',
  main: './sites-entry.mjs',
  compatibility_date: '2026-09-30',
  compatibility_flags: ['nodejs_compat'],
};
writeFileSync(resolve(root, '.wrangler/sites-build.json'), JSON.stringify(config));
run('node_modules/wrangler/bin/wrangler.js', [
  'deploy',
  '--dry-run',
  '--config',
  '.wrangler/sites-build.json',
  '--outdir',
  resolve(output, 'server'),
]);
renameSync(resolve(output, 'server/sites-entry.js'), resolve(output, 'server/index.js'));
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
    },
    null,
    2,
  ) + '\n',
);

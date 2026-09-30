// Valida mensagens de commit no formato Conventional Commits.
// Exemplo válido: "feat(importar): pré-visualização com conflitos"
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) process.exit(0);
const first = readFileSync(file, 'utf8').split('\n')[0] ?? '';
const types = 'feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert';
const ok = new RegExp(`^(${types})(\\([a-z0-9-]+\\))?!?: .{3,}`).test(first) || /^Merge /.test(first);

if (!ok) {
  console.error(`\n✖ Mensagem de commit inválida: "${first}"`);
  console.error(`  Formato: <tipo>(<âmbito>): <descrição>   tipos: ${types.replaceAll('|', ', ')}\n`);
  process.exit(1);
}

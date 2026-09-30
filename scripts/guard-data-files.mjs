// Impede que dados reais entrem no repositório.
// Bloqueia folhas de cálculo, CSVs fora de tests/fixtures e bases de dados SQLite.
// Uso: node scripts/guard-data-files.mjs <ficheiros...>   (sem argumentos lê `git diff --cached`)
import { execSync } from 'node:child_process';

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

const blocked = files
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => {
    if (/\.(xlsx|xls|ods|sqlite3?|db)$/i.test(f)) return true;
    if (/\.csv$/i.test(f)) return !f.startsWith('tests/fixtures/');
    return false;
  });

if (blocked.length) {
  console.error('\n✖ Ficheiros de dados bloqueados (os dados reais nunca entram no repositório):');
  for (const f of blocked) console.error(`  - ${f}`);
  console.error('\nCSVs de teste sintéticos vão para tests/fixtures/. Ver AGENTS.md › Dados reais.\n');
  process.exit(1);
}

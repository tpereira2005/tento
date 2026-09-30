import { Hono } from 'hono';
import { z } from 'zod';
import { diffTransactions, parseTransactionsCsv, type ParsedRow } from '../../core';
import type { Db } from '../db/client';
import { commitImport, existingForDiff, listImports, listWallets, undoImport } from '../db/repos';
import { apiError, failure, notFound, validate, type AppEnv } from '../http';

const importBody = z.object({
  walletId: z.string().min(1).max(64),
  filename: z.string().trim().min(1).max(255),
  csv: z
    .string()
    .min(1)
    .max(5 * 1024 * 1024),
});
const idParam = z.object({ id: z.string().min(1).max(64) });

const MAX_ISSUES = 200;
const MAX_CONFLICTS = 100;
const SAMPLE = 20;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lê o CSV e compara-o com o que já está guardado na conta. Corre SEMPRE no servidor. */
async function analyze(db: Db, userId: string, body: z.infer<typeof importBody>) {
  const wallets = await listWallets(db, userId);
  if (!wallets.some((w) => w.id === body.walletId)) return { kind: 'not_found' as const };
  const parsed = parseTransactionsCsv(body.csv);
  if (!parsed.ok) return { kind: 'fatal' as const, error: parsed.error };
  const { rows, issues, meta } = parsed.value;
  const existing = await existingForDiff(db, userId, body.walletId);
  const diff = diffTransactions<ParsedRow, (typeof existing)[number]>(rows, existing);
  const invalidLines = new Set(issues.map((i) => i.line)).size;
  return { kind: 'ok' as const, rows, issues, meta, diff, invalidLines };
}

export function importRoutes() {
  const app = new Hono<AppEnv>();

  app.post('/preview', validate('json', importBody), async (c) => {
    const a = await analyze(c.get('db'), c.get('user').id, c.req.valid('json'));
    if (a.kind === 'not_found') return notFound();
    if (a.kind === 'fatal') return apiError(422, a.error.code, 'Ficheiro CSV inválido.', a.error);
    const { diff } = a;
    return c.json({
      meta: a.meta,
      counts: {
        total: a.meta.totalDataLines,
        valid: a.rows.length,
        invalid: a.invalidLines,
        toAdd: diff.toAdd.length,
        duplicates: diff.duplicates.length,
        conflicts: diff.conflicts.length,
        missingFromFile: diff.missingFromFile.length,
      },
      issues: a.issues.slice(0, MAX_ISSUES),
      issuesTotal: a.issues.length,
      conflicts: diff.conflicts.slice(0, MAX_CONFLICTS),
      toAddSample: diff.toAdd.slice(0, SAMPLE),
    });
  });

  app.post('/', validate('json', importBody), async (c) => {
    const body = c.req.valid('json');
    const a = await analyze(c.get('db'), c.get('user').id, body);
    if (a.kind === 'not_found') return notFound();
    if (a.kind === 'fatal') return apiError(422, a.error.code, 'Ficheiro CSV inválido.', a.error);
    const r = await commitImport(c.get('db'), c.get('user').id, {
      walletId: body.walletId,
      filename: body.filename,
      fileSha256: await sha256Hex(body.csv),
      rowsTotal: a.meta.totalDataLines,
      rowsInvalid: a.invalidLines,
      rowsDuplicate: a.diff.duplicates.length,
      rowsConflict: a.diff.conflicts.length,
      rows: a.diff.toAdd,
    });
    return r.ok ? c.json(r.value, 201) : failure(r.error);
  });

  app.get('/', async (c) => c.json({ items: await listImports(c.get('db'), c.get('user').id) }));

  app.post('/:id/undo', validate('param', idParam), async (c) => {
    const r = await undoImport(c.get('db'), c.get('user').id, c.req.valid('param').id);
    return r.ok ? c.json(r.value) : failure(r.error);
  });

  return app;
}

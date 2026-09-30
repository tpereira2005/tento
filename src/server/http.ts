import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodType } from 'zod';
import type { Db } from './db/client';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface AppEnv {
  Variables: { db: Db; user: SessionUser };
}

/** Resposta de erro uniforme: `{ error: { code, message, details? } }`. */
export function apiError(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
  return Response.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

const FAILURES: Record<string, [ContentfulStatusCode, string]> = {
  not_found: [404, 'Não encontrado.'],
  duplicate: [409, 'Já existe.'],
  already_undone: [409, 'Este import já foi desfeito.'],
  invalid_name: [422, 'Nome inválido.'],
  invalid: [422, 'Dados inválidos.'],
};

/** Converte o erro de um repositório (`Result`) na resposta HTTP respetiva. */
export function failure(code: string) {
  const [status, message] = FAILURES[code] ?? [422, 'Dados inválidos.'];
  return apiError(status, code, message);
}

export const notFound = () => failure('not_found');

/** Validador zod que responde 422 com os problemas em `details`. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      return apiError(422, 'validation_error', 'Dados inválidos.', result.error.issues);
    }
    return undefined;
  });
}

/** Remove chaves `undefined` (compatível com `exactOptionalPropertyTypes`). */
export function compact<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

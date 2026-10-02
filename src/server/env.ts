import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('file:./data/tento.db'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET tem de ter pelo menos 32 caracteres'),
  BETTER_AUTH_URL: z.url().default('http://localhost:5173'),
  OWNER_EMAIL: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/\s/g, '').toLowerCase() || undefined : value),
    z.email().optional(),
  ),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/** Lê e valida a configuração. Falha com uma mensagem legível (sem mostrar valores) se algo faltar. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida (${problems}). Vê .env.example.`);
  }
  return parsed.data;
}

import { betterAuth, APIError, type BetterAuthRateLimitOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { account, session, user, verification } from './db/schema';
import type { Db } from './db/client';
import { countUsers } from './db/repos';

export type RegistrationMode = 'first-user-only' | 'open';

export interface AuthConfig {
  db: Db;
  secret: string;
  baseURL: string;
  registration: RegistrationMode;
  /** Só para testes: substitui a configuração do limite de pedidos (por omissão ativo, 100/min). */
  rateLimit?: BetterAuthRateLimitOptions;
}

/**
 * Better Auth com e-mail e palavra-passe. Com `first-user-only` o registo fecha assim que existe um
 * utilizador (app privada de um só dono); `open` existe só para os testes de isolamento.
 */
export function createAuth({ db, secret, baseURL, registration, rateLimit }: AuthConfig) {
  const secure = baseURL.startsWith('https://');
  const auth = betterAuth({
    appName: 'Tento',
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, autoSignIn: true },
    rateLimit: rateLimit ?? { enabled: true, window: 60, max: 100 },
    advanced: { cookiePrefix: 'tento', useSecureCookies: secure },
    databaseHooks: {
      user: {
        create: {
          before: async () => {
            if (registration === 'first-user-only' && (await countUsers(db)) > 0) {
              throw new APIError('FORBIDDEN', {
                code: 'registration_closed',
                message: 'O registo está fechado.',
              });
            }
          },
        },
      },
    },
  });
  return Object.assign(auth, { tento: { registration, baseURL } });
}

export type TentoAuth = ReturnType<typeof createAuth>;

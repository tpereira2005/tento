import { createAuthClient } from 'better-auth/react';

/** Cliente do Better Auth (mesma origem; a API está em `/api/auth`). */
export const authClient = createAuthClient({ basePath: '/api/auth' });

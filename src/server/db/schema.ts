import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/*
 * Esquema SQLite (libSQL em desenvolvimento, D1 no Cloudflare / ChatGPT Sites).
 * Valores em cêntimos inteiros; datas de calendário como texto ISO `AAAA-MM-DD`.
 * Todas as tabelas da aplicação têm `user_id`: os repositórios filtram SEMPRE por ele.
 */

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ─── Better Auth ────────────────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─── Aplicação ──────────────────────────────────────────────────────────────────

/** Casa de apostas. */
export const bookmaker = sqliteTable(
  'bookmaker',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('bookmaker_user_slug_uq').on(t.userId, t.slug)],
);

/** Perfil (por exemplo, uma pessoa). */
export const profile = sqliteTable(
  'profile',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('profile_user_name_uq').on(t.userId, t.name)],
);

/** Conta = perfil × casa. Cada CSV corresponde a uma conta. */
export const wallet = sqliteTable(
  'wallet',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    bookmakerId: text('bookmaker_id')
      .notNull()
      .references(() => bookmaker.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('wallet_profile_bookmaker_uq').on(t.profileId, t.bookmakerId),
    index('wallet_user_idx').on(t.userId),
  ],
);

/** Um import de CSV. Guarda só contagens e o hash do ficheiro, nunca o conteúdo. */
export const importBatch = sqliteTable(
  'import_batch',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallet.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    fileSha256: text('file_sha256').notNull(),
    rowsTotal: integer('rows_total').notNull(),
    rowsAdded: integer('rows_added').notNull(),
    rowsDuplicate: integer('rows_duplicate').notNull(),
    rowsInvalid: integer('rows_invalid').notNull(),
    rowsConflict: integer('rows_conflict').notNull(),
    createdAt: createdAt(),
    undoneAt: integer('undone_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('import_batch_user_idx').on(t.userId, t.createdAt)],
);

export const TXN_TYPES = ['deposit', 'withdrawal'] as const;
export const TXN_SOURCES = ['csv', 'manual'] as const;

/** Transação (depósito ou levantamento) de uma conta. */
export const txn = sqliteTable(
  'txn',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallet.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    type: text('type', { enum: TXN_TYPES }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    seq: integer('seq').notNull().default(0),
    source: text('source', { enum: TXN_SOURCES }).notNull(),
    importBatchId: text('import_batch_id').references(() => importBatch.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('txn_user_date_idx').on(t.userId, t.date),
    index('txn_wallet_date_idx').on(t.walletId, t.date),
    index('txn_batch_idx').on(t.importBatchId),
    check('txn_amount_positive', sql`${t.amountCents} > 0`),
    check('txn_type_valid', sql`${t.type} in ('deposit', 'withdrawal')`),
    check('txn_source_valid', sql`${t.source} in ('csv', 'manual')`),
    check('txn_date_iso', sql`${t.date} glob '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'`),
  ],
);

export const THEMES = ['system', 'light', 'dark'] as const;

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  theme: text('theme', { enum: THEMES }).notNull().default('system'),
  locale: text('locale').notNull().default('pt-PT'),
  updatedAt: updatedAt(),
});

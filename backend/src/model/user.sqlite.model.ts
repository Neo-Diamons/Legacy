import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  tokenVersion: integer('token_version').notNull().default(0),
  privacyConsentAt: integer('privacy_consent_at', { mode: 'timestamp' }),
  privacyPolicyVersion: text('privacy_policy_version'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

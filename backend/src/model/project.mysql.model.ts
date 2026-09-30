import { sql } from 'drizzle-orm';
import { datetime, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from './user.mysql.model.js';

export const projects = mysqlTable('projects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 32 }).notNull(),
  createdAt: datetime('created_at', { mode: 'date' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Project = typeof projects.$inferSelect;

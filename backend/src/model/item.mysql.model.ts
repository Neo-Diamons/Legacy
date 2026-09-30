import { sql } from 'drizzle-orm';
import { boolean, datetime, mysqlEnum, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { PRIORITIES } from './priority.js';
import { users } from './user.mysql.model.js';
import { projects } from './project.mysql.model.js';

export const todoItems = mysqlTable('todo_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 36 })
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  completed: boolean('completed').notNull().default(false),
  priority: mysqlEnum('priority', PRIORITIES).notNull().default('medium'),
  dueDate: datetime('due_date', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Item = typeof todoItems.$inferSelect;

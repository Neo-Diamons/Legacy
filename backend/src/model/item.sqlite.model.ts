import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { PRIORITIES } from './priority.js';
import { users } from './user.sqlite.model.js';
import { projects } from './project.sqlite.model.js';

export const todoItems = sqliteTable('todo_items', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Item = typeof todoItems.$inferSelect;
export type ItemUpdate = Pick<Item, 'name' | 'description' | 'completed' | 'priority' | 'dueDate'> &
  Partial<Pick<Item, 'projectId'>>;

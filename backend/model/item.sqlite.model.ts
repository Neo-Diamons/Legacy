import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const todoItems = sqliteTable('todo_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

export type Item = typeof todoItems.$inferSelect;
export type ItemUpdate = Pick<Item, 'name' | 'completed'>;

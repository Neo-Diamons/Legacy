import { boolean, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

export const todoItems = mysqlTable('todo_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  completed: boolean('completed').notNull().default(false),
});

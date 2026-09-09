import { boolean, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const todoItems = mysqlTable('todo_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  completed: boolean('completed').notNull().default(false),
});

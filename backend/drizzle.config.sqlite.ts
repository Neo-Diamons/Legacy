import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './model/item.sqlite.model.ts',
  out: './drizzle/sqlite',
  dbCredentials: {
    url: process.env.SQLITE_DB_LOCATION || '/etc/todos/todo.db',
  },
});

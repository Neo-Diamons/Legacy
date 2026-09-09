import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/model/item.mysql.model.ts',
  out: './drizzle/mysql',
  dbCredentials: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB ?? 'todos',
  },
});

import { defineConfig } from 'drizzle-kit';
import { sqliteLocation, useMysql } from '@db/config.js';

export default defineConfig(
  useMysql
    ? {
        dialect: 'mysql',
        schema: './src/model/*.mysql.model.ts',
        out: './drizzle/mysql',
        dbCredentials: {
          host: process.env.MYSQL_HOST ?? 'localhost',
          user: process.env.MYSQL_USER,
          password: process.env.MYSQL_PASSWORD,
          database: process.env.MYSQL_DB ?? 'todos',
        },
      }
    : {
        dialect: 'sqlite',
        schema: './src/model/*.sqlite.model.ts',
        out: './drizzle/sqlite',
        dbCredentials: {
          url: sqliteLocation,
        },
      }
);

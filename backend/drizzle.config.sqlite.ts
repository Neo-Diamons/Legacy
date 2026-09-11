import { defineConfig } from 'drizzle-kit';
import { sqliteLocation } from './src/db/config.js';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/model/item.sqlite.model.ts',
  out: './drizzle/sqlite',
  dbCredentials: {
    url: sqliteLocation,
  },
});

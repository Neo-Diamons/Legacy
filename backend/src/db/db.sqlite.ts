import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolveMigrationsFolder, sqliteLocation } from '@db/config.js';

let connection: Database.Database | undefined;

export let db: BetterSQLite3Database;

export async function init(): Promise<void> {
  connection?.close();

  const dir = path.dirname(sqliteLocation);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  connection = new Database(sqliteLocation);
  db = drizzle(connection);

  if (process.env.NODE_ENV !== 'test') console.log(`Using sqlite database at ${sqliteLocation}`);

  migrate(db, { migrationsFolder: resolveMigrationsFolder('sqlite') });
}

export async function teardown(): Promise<void> {
  connection?.close();
  connection = undefined;
}

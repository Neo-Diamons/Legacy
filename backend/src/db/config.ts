import fs from 'fs';
import path from 'path';

export const useMysql = Boolean(process.env.MYSQL_HOST || process.env.MYSQL_HOST_FILE);

export function resolveMigrationsFolder(dialect: 'mysql' | 'sqlite'): string {
  const folder = path.resolve('drizzle', dialect);

  if (!fs.existsSync(folder)) {
    throw new Error(
      `Migrations folder not found: ${folder} (cwd: ${process.cwd()}). Run from the backend/ workspace root.`,
    );
  }

  return folder;
}

export const DEFAULT_SQLITE_LOCATION = '/etc/todos/todo.db';

export const sqliteLocation = process.env.SQLITE_DB_LOCATION || DEFAULT_SQLITE_LOCATION;

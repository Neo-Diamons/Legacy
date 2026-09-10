import fs from 'fs';
import { createPool, type Pool } from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import waitPort from 'wait-port';
import { parsePort } from '@utils/port.js';
import { resolveMigrationsFolder } from '@db/config.js';

const {
  MYSQL_HOST: HOST,
  MYSQL_HOST_FILE: HOST_FILE,
  MYSQL_PORT: PORT,
  MYSQL_PORT_FILE: PORT_FILE,
  MYSQL_USER: USER,
  MYSQL_USER_FILE: USER_FILE,
  MYSQL_PASSWORD: PASSWORD,
  MYSQL_PASSWORD_FILE: PASSWORD_FILE,
  MYSQL_DB: DB,
  MYSQL_DB_FILE: DB_FILE,
} = process.env;

const fromEnv = (value?: string, file?: string): string | undefined => {
  const raw = file ? fs.readFileSync(file, 'utf8') : value;
  return raw?.trim() || undefined;
};

let pool: Pool;

export let db: MySql2Database;

export async function init(): Promise<void> {
  const host = fromEnv(HOST, HOST_FILE);
  const port = parsePort(fromEnv(PORT, PORT_FILE), 3306);
  const user = fromEnv(USER, USER_FILE);
  const password = fromEnv(PASSWORD, PASSWORD_FILE);
  const database = fromEnv(DB, DB_FILE);

  await waitPort({ host, port, timeout: 10000, waitForDns: true });

  pool = createPool({
    connectionLimit: 5,
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
    flags: ['FOUND_ROWS'],
  });
  db = drizzle(pool);

  await migrate(db, { migrationsFolder: resolveMigrationsFolder('mysql') });

  console.log(`Connected to mysql db at host ${host}`);
}

export async function teardown(): Promise<void> {
  await pool.end();
}

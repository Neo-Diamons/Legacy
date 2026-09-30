import { useMysql } from '@db/config.js';
import * as sqlite from '@db/db.sqlite.js';
import * as mysql from '@db/db.mysql.js';

export { useMysql, sqlite, mysql };

export const driver = useMysql ? mysql : sqlite;

try {
  await driver.init();
} catch (err) {
  console.error(`Failed to initialize ${useMysql ? 'mysql' : 'sqlite'} database`, err);
  process.exit(1);
}

import { useMysql } from '@db/driver.js';
import * as sqlite from '@db/db.sqlite.js';
import * as mysql from '@db/db.mysql.js';

export { useMysql, sqlite, mysql };

const driver = useMysql ? mysql : sqlite;

await driver.init();

const shutdown = () => {
  driver
    .teardown()
    .catch(() => {})
    .finally(() => process.exit());
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

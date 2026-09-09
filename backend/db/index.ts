import { useMysql } from '../config.js';
import * as sqlite from './db.sqlite.js';
import * as mysql from './db.mysql.js';

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

import { mysql, sqlite, useMysql } from '@db';
import { todoItems as mysqlItems } from '@model/item.mysql.model.js';
import { todoItems as sqliteItems } from '@model/item.sqlite.model.js';
import { projects as mysqlProjects } from '@model/project.mysql.model.js';
import { projects as sqliteProjects } from '@model/project.sqlite.model.js';
import { users as mysqlUsers } from '@model/user.mysql.model.js';
import { users as sqliteUsers } from '@model/user.sqlite.model.js';

/**
 * Empties every table (children first, so foreign keys hold) on whichever driver the run uses.
 * Tests call it in beforeEach so they start from a known-empty database.
 */
export async function resetDb(): Promise<void> {
  if (useMysql) {
    await mysql.db.delete(mysqlItems);
    await mysql.db.delete(mysqlProjects);
    await mysql.db.delete(mysqlUsers);
    return;
  }
  sqlite.db.delete(sqliteItems).run();
  sqlite.db.delete(sqliteProjects).run();
  sqlite.db.delete(sqliteUsers).run();
}

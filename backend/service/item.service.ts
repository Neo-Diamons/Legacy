import { eq } from 'drizzle-orm';
import { useMysql } from '../config.js';
import * as sqlite from '../db/db.sqlite.js';
import * as mysql from '../db/db.mysql.js';
import { todoItems as sqliteItems, type Item, type ItemUpdate } from '../model/item.sqlite.model.js';
import { todoItems as mysqlItems } from '../model/item.mysql.model.js';

export type { Item, ItemUpdate };

interface ItemService {
  init(): Promise<void>;
  teardown(): Promise<void>;
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  storeItem(item: Item): Promise<void>;
  updateItem(id: string, item: ItemUpdate): Promise<void>;
  removeItem(id: string): Promise<void>;
}

const sqliteItemService: ItemService = {
  init: sqlite.init,
  teardown: sqlite.teardown,
  async getItems() {
    return sqlite.db.select().from(sqliteItems).all();
  },
  async getItem(id) {
    return sqlite.db.select().from(sqliteItems).where(eq(sqliteItems.id, id)).get();
  },
  async storeItem(item) {
    sqlite.db.insert(sqliteItems).values(item).run();
  },
  async updateItem(id, item) {
    sqlite.db
      .update(sqliteItems)
      .set({ name: item.name, completed: item.completed })
      .where(eq(sqliteItems.id, id))
      .run();
  },
  async removeItem(id) {
    sqlite.db.delete(sqliteItems).where(eq(sqliteItems.id, id)).run();
  },
};

const mysqlItemService: ItemService = {
  init: mysql.init,
  teardown: mysql.teardown,
  async getItems() {
    return mysql.db.select().from(mysqlItems);
  },
  async getItem(id) {
    const rows = await mysql.db.select().from(mysqlItems).where(eq(mysqlItems.id, id)).limit(1);
    return rows[0];
  },
  async storeItem(item) {
    await mysql.db.insert(mysqlItems).values(item);
  },
  async updateItem(id, item) {
    await mysql.db.update(mysqlItems).set({ name: item.name, completed: item.completed }).where(eq(mysqlItems.id, id));
  },
  async removeItem(id) {
    await mysql.db.delete(mysqlItems).where(eq(mysqlItems.id, id));
  },
};

export const itemService: ItemService = useMysql ? mysqlItemService : sqliteItemService;

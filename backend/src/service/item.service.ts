import { and, asc, desc, eq, gte, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { useMysql, sqlite, mysql } from '@db';
import { todoItems as sqliteItems, type Item, type ItemUpdate } from '@model/item.sqlite.model.js';
import { todoItems as mysqlItems } from '@model/item.mysql.model.js';
import type { ListItemsQuery } from '@schemas/item.schemas.js';

export type { Item, ItemUpdate };

interface ItemService {
  getItems(options?: ListItemsQuery): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  storeItem(item: Item): Promise<void>;
  updateItem(id: string, item: ItemUpdate): Promise<number>;
  removeItem(id: string): Promise<number>;
}

interface ItemColumns {
  name: AnyColumn;
  priority: AnyColumn;
  dueDate: AnyColumn;
  completed: AnyColumn;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function getWeekRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const diffToMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

function buildItemFilter(columns: ItemColumns, options?: ListItemsQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (options?.priority) conditions.push(eq(columns.priority, options.priority));

  if (options?.filter === 'overdue') {
    conditions.push(lt(columns.dueDate, new Date()), eq(columns.completed, false));
  } else if (options?.filter === 'today') {
    const { start, end } = getTodayRange();
    conditions.push(gte(columns.dueDate, start), lt(columns.dueDate, end));
  } else if (options?.filter === 'week') {
    const { start, end } = getWeekRange();
    conditions.push(gte(columns.dueDate, start), lt(columns.dueDate, end));
  }

  return conditions.length ? and(...conditions) : undefined;
}

function buildItemOrderBy(columns: ItemColumns, options?: ListItemsQuery): SQL[] | undefined {
  if (options?.sortBy === 'priority') {
    const order = sql`CASE ${columns.priority} WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`;
    return [options.sortOrder === 'asc' ? asc(order) : desc(order)];
  }

  if (options?.sortBy === 'dueDate') {
    const nullsLast = sql`${columns.dueDate} IS NULL`;
    return [asc(nullsLast), options.sortOrder === 'desc' ? desc(columns.dueDate) : asc(columns.dueDate)];
  }

  if (options?.sortBy === 'name') {
    return [options.sortOrder === 'desc' ? desc(columns.name) : asc(columns.name)];
  }

  return undefined;
}

const sqliteItemService: ItemService = {
  async getItems(options) {
    let query = sqlite.db.select().from(sqliteItems).$dynamic();

    const where = buildItemFilter(sqliteItems, options);
    if (where) query = query.where(where);

    const orderBy = buildItemOrderBy(sqliteItems, options);
    if (orderBy) query = query.orderBy(...orderBy);

    return query.all();
  },
  async getItem(id) {
    return sqlite.db.select().from(sqliteItems).where(eq(sqliteItems.id, id)).get();
  },
  async storeItem(item) {
    sqlite.db.insert(sqliteItems).values(item).run();
  },
  async updateItem(id, item) {
    return sqlite.db
      .update(sqliteItems)
      .set({
        name: item.name,
        description: item.description,
        completed: item.completed,
        priority: item.priority,
        dueDate: item.dueDate,
      })
      .where(eq(sqliteItems.id, id))
      .run().changes;
  },
  async removeItem(id) {
    return sqlite.db.delete(sqliteItems).where(eq(sqliteItems.id, id)).run().changes;
  },
};

const mysqlItemService: ItemService = {
  async getItems(options) {
    let query = mysql.db.select().from(mysqlItems).$dynamic();

    const where = buildItemFilter(mysqlItems, options);
    if (where) query = query.where(where);

    const orderBy = buildItemOrderBy(mysqlItems, options);
    if (orderBy) query = query.orderBy(...orderBy);

    return query;
  },
  async getItem(id) {
    const rows = await mysql.db.select().from(mysqlItems).where(eq(mysqlItems.id, id)).limit(1);
    return rows[0];
  },
  async storeItem(item) {
    await mysql.db.insert(mysqlItems).values(item);
  },
  async updateItem(id, item) {
    const [res] = await mysql.db
      .update(mysqlItems)
      .set({
        name: item.name,
        description: item.description,
        completed: item.completed,
        priority: item.priority,
        dueDate: item.dueDate,
      })
      .where(eq(mysqlItems.id, id));
    return res.affectedRows;
  },
  async removeItem(id) {
    const [res] = await mysql.db.delete(mysqlItems).where(eq(mysqlItems.id, id));
    return res.affectedRows;
  },
};

export const itemService: ItemService = useMysql ? mysqlItemService : sqliteItemService;

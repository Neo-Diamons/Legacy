import { and, asc, desc, eq, gte, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { useMysql, sqlite, mysql } from '@db';
import { todoItems as sqliteItems, type Item, type ItemUpdate } from '@model/item.sqlite.model.js';
import { todoItems as mysqlItems } from '@model/item.mysql.model.js';
import type { ListItemsQuery } from '@schemas/item.schemas.js';

export type { Item, ItemUpdate };

export const LEGACY_USER_ID = '00000000-0000-4000-8000-000000000000';

function normalizeItem(item: Item): Item {
  if (item.projectId !== null) return item;
  const normalized = { ...item };
  delete normalized.projectId;
  return normalized;
}

interface ItemService {
  getItems(userIdOrOptions?: string | ListItemsQuery, options?: ListItemsQuery): Promise<Item[]>;
  getItem(id: string, userId?: string): Promise<Item | undefined>;
  storeItem(item: Item): Promise<void>;
  updateItem(id: string, item: ItemUpdate, userId?: string): Promise<number>;
  removeItem(id: string, userId?: string): Promise<number>;
}

interface ItemColumns {
  userId: AnyColumn;
  name: AnyColumn;
  priority: AnyColumn;
  dueDate: AnyColumn;
  completed: AnyColumn;
}

function resolveItemQuery(userIdOrOptions?: string | ListItemsQuery, options?: ListItemsQuery) {
  return {
    userId: typeof userIdOrOptions === 'string' ? userIdOrOptions : LEGACY_USER_ID,
    options: typeof userIdOrOptions === 'string' ? options : userIdOrOptions,
  };
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

function buildItemFilter(columns: ItemColumns, userId: string, options?: ListItemsQuery): SQL {
  const conditions: SQL[] = [eq(columns.userId, userId)];

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

  return and(...conditions)!;
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
  async getItems(userIdOrOptions, options) {
    let query = sqlite.db.select().from(sqliteItems).$dynamic();
    const resolved = resolveItemQuery(userIdOrOptions, options);

    query = query.where(buildItemFilter(sqliteItems, resolved.userId, resolved.options));

    const orderBy = buildItemOrderBy(sqliteItems, resolved.options);
    if (orderBy) query = query.orderBy(...orderBy);

    return query.all().map(normalizeItem);
  },
  async getItem(id, userId = LEGACY_USER_ID) {
    const item = sqlite.db
      .select()
      .from(sqliteItems)
      .where(and(eq(sqliteItems.id, id), eq(sqliteItems.userId, userId)))
      .get();
    return item ? normalizeItem(item) : undefined;
  },
  async storeItem(item) {
    sqlite.db.insert(sqliteItems).values(item).run();
  },
  async updateItem(id, item, userId = LEGACY_USER_ID) {
    return sqlite.db
      .update(sqliteItems)
      .set({
        name: item.name,
        description: item.description,
        completed: item.completed,
        priority: item.priority,
        dueDate: item.dueDate,
        projectId: item.projectId,
      })
      .where(and(eq(sqliteItems.id, id), eq(sqliteItems.userId, userId)))
      .run().changes;
  },
  async removeItem(id, userId = LEGACY_USER_ID) {
    return sqlite.db
      .delete(sqliteItems)
      .where(and(eq(sqliteItems.id, id), eq(sqliteItems.userId, userId)))
      .run().changes;
  },
};

const mysqlItemService: ItemService = {
  async getItems(userIdOrOptions, options) {
    let query = mysql.db.select().from(mysqlItems).$dynamic();
    const resolved = resolveItemQuery(userIdOrOptions, options);

    query = query.where(buildItemFilter(mysqlItems, resolved.userId, resolved.options));

    const orderBy = buildItemOrderBy(mysqlItems, resolved.options);
    if (orderBy) query = query.orderBy(...orderBy);

    return query.then((items) => items.map(normalizeItem));
  },
  async getItem(id, userId = LEGACY_USER_ID) {
    const rows = await mysql.db
      .select()
      .from(mysqlItems)
      .where(and(eq(mysqlItems.id, id), eq(mysqlItems.userId, userId)))
      .limit(1);
    return rows[0] ? normalizeItem(rows[0]) : undefined;
  },
  async storeItem(item) {
    await mysql.db.insert(mysqlItems).values(item);
  },
  async updateItem(id, item, userId = LEGACY_USER_ID) {
    const [res] = await mysql.db
      .update(mysqlItems)
      .set({
        name: item.name,
        description: item.description,
        completed: item.completed,
        priority: item.priority,
        dueDate: item.dueDate,
        projectId: item.projectId,
      })
      .where(and(eq(mysqlItems.id, id), eq(mysqlItems.userId, userId)));
    return res.affectedRows;
  },
  async removeItem(id, userId = LEGACY_USER_ID) {
    const [res] = await mysql.db.delete(mysqlItems).where(and(eq(mysqlItems.id, id), eq(mysqlItems.userId, userId)));
    return res.affectedRows;
  },
};

export const itemService: ItemService = useMysql ? mysqlItemService : sqliteItemService;

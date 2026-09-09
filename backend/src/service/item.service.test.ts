import { existsSync, unlinkSync } from 'fs';
const location = process.env.SQLITE_DB_LOCATION || '/etc/todos/todo.db';

import { itemService as db } from '@service/item.service.js';
import { init, teardown } from '@db/db.sqlite.js';

const { storeItem, getItems, updateItem, removeItem, getItem } = db;

const ITEM = {
  id: '7aef3d7c-d301-4846-8358-2a91ec9d6be3',
  name: 'Test',
  completed: false,
};

beforeEach(async () => {
  if (existsSync(location)) {
    unlinkSync(location);
  }
  await init();
});

afterEach(async () => {
  try {
    await teardown();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'SQLITE_MISUSE') {
      throw error;
    }
  }
});

test('it can store and retrieve items', async () => {
  await storeItem(ITEM);

  const items = await getItems();
  expect(items.length).toBe(1);
  expect(items[0]).toEqual(ITEM);
});

test('it can update an existing item', async () => {
  const initialItems = await getItems();
  expect(initialItems.length).toBe(0);

  await storeItem(ITEM);

  const changed = await updateItem(ITEM.id, Object.assign({}, ITEM, { completed: !ITEM.completed }));
  expect(changed).toBe(1);

  const items = await getItems();
  expect(items.length).toBe(1);
  expect(items[0].completed).toBe(!ITEM.completed);
});

test('updateItem returns 0 for an unknown id', async () => {
  expect(await updateItem('this-id-does-not-exist', { name: 'x', completed: false })).toBe(0);
});

test('it can remove an existing item', async () => {
  await storeItem(ITEM);

  const removed = await removeItem(ITEM.id);
  expect(removed).toBe(1);

  const items = await getItems();
  expect(items.length).toBe(0);
});

test('removeItem returns 0 for an unknown id', async () => {
  expect(await removeItem('this-id-does-not-exist')).toBe(0);
});

test('it can get a single item', async () => {
  await storeItem(ITEM);

  const item = await getItem(ITEM.id);
  expect(item).toEqual(ITEM);
});

test('it can store an item with an empty name', async () => {
  const item = {
    id: 'empty-name-id',
    name: '',
    completed: false,
  };

  await db.storeItem(item);

  const result = await db.getItem(item.id);

  expect(result).toEqual(item);
});

test('it can store an item with a very long name', async () => {
  const item = {
    id: 'long-name-id',
    name: 'A'.repeat(1000),
    completed: false,
  };

  await db.storeItem(item);

  const result = await db.getItem(item.id);

  expect(result).toEqual(item);
});

test('it can store a completed item', async () => {
  const item = {
    id: 'completed-id',
    name: 'Already completed',
    completed: true,
  };

  await db.storeItem(item);

  const result = await db.getItem(item.id);

  expect(result).toEqual(item);
});

test('it returns no item for an unknown id', async () => {
  const result = await db.getItem('this-id-does-not-exist');

  expect(result).toBeUndefined();
});

test('it can store multiple items', async () => {
  const item2 = {
    id: 'second-id',
    name: 'Second item',
    completed: true,
  };

  await db.storeItem(ITEM);
  await db.storeItem(item2);

  const items = await db.getItems();

  expect(items.length).toBe(2);
  expect(items).toContainEqual(ITEM);
  expect(items).toContainEqual(item2);
});

test('it only updates the selected item', async () => {
  const item2 = {
    id: 'second-item-id',
    name: 'Second item',
    completed: false,
  };

  await db.storeItem(ITEM);
  await db.storeItem(item2);

  await db.updateItem(ITEM.id, Object.assign({}, ITEM, { completed: true }));

  const items = await db.getItems();

  expect(items).toContainEqual({
    ...ITEM,
    completed: true,
  });

  expect(items).toContainEqual(item2);
});

test('it only removes the selected item', async () => {
  const item2 = {
    id: 'second-item-id',
    name: 'Second item',
    completed: false,
  };

  await db.storeItem(ITEM);
  await db.storeItem(item2);

  await db.removeItem(ITEM.id);

  const items = await db.getItems();

  expect(items.length).toBe(1);
  expect(items[0]).toEqual(item2);
});

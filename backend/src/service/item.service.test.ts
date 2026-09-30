import { existsSync, unlinkSync } from 'fs';

import { itemService as db } from '@service/item.service.js';
import { init, teardown, db as sqliteDb } from '@db/db.sqlite.js';
import { sqliteLocation } from '@db/config.js';
import { users } from '@model/user.sqlite.model.js';
import { projects } from '@model/project.sqlite.model.js';

const { storeItem, getItems, updateItem, removeItem, getItem } = db;

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const OTHER_PROJECT = '44444444-4444-4444-8444-444444444444';

const makeItem = (overrides: Partial<Parameters<typeof storeItem>[0]> = {}) => ({
  id: '7aef3d7c-d301-4846-8358-2a91ec9d6be3',
  userId: USER,
  projectId: PROJECT,
  name: 'Test',
  completed: false,
  priority: 'medium' as const,
  description: null,
  dueDate: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const ITEM = makeItem();
const { name, description, completed, priority, dueDate } = ITEM;
const ITEM_FIELDS = { name, description, completed, priority, dueDate };

beforeEach(async () => {
  if (existsSync(sqliteLocation)) {
    unlinkSync(sqliteLocation);
  }
  await init();

  for (const [id, email] of [
    [USER, 'user@example.com'],
    [OTHER_USER, 'other@example.com'],
  ]) {
    sqliteDb.insert(users).values({ id, email, name: email, passwordHash: 'x' }).run();
  }
  sqliteDb.insert(projects).values({ id: PROJECT, userId: USER, name: 'P', color: '#000000' }).run();
  sqliteDb.insert(projects).values({ id: OTHER_PROJECT, userId: OTHER_USER, name: 'O', color: '#000000' }).run();
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

  const items = await getItems(USER);
  expect(items.length).toBe(1);
  expect(items[0]).toEqual(ITEM);
});

test('it can update an existing item', async () => {
  expect(await getItems(USER)).toHaveLength(0);

  await storeItem(ITEM);

  const changed = await updateItem(ITEM.id, { ...ITEM_FIELDS, completed: true }, USER);
  expect(changed).toBe(1);

  const items = await getItems(USER);
  expect(items.length).toBe(1);
  expect(items[0].completed).toBe(true);
});

test('updateItem returns 0 for an unknown id', async () => {
  expect(await updateItem('this-id-does-not-exist', ITEM_FIELDS, USER)).toBe(0);
});

test('it can remove an existing item', async () => {
  await storeItem(ITEM);

  expect(await removeItem(ITEM.id, USER)).toBe(1);
  expect(await getItems(USER)).toHaveLength(0);
});

test('removeItem returns 0 for an unknown id', async () => {
  expect(await removeItem('this-id-does-not-exist', USER)).toBe(0);
});

test('it can get a single item', async () => {
  await storeItem(ITEM);

  expect(await getItem(ITEM.id, USER)).toEqual(ITEM);
});

test('it can store an item with an empty name', async () => {
  const item = makeItem({ id: 'empty-name-id', name: '' });
  await storeItem(item);

  expect(await getItem(item.id, USER)).toEqual(item);
});

test('it can store an item with a very long name', async () => {
  const item = makeItem({ id: 'long-name-id', name: 'A'.repeat(1000) });
  await storeItem(item);

  expect(await getItem(item.id, USER)).toEqual(item);
});

test('it can store a completed item', async () => {
  const item = makeItem({ id: 'completed-id', name: 'Already completed', completed: true });
  await storeItem(item);

  expect(await getItem(item.id, USER)).toEqual(item);
});

test('it can store and update an item with a description', async () => {
  const item = makeItem({ id: 'described-id', description: 'A description' });
  await storeItem(item);
  expect(await getItem(item.id, USER)).toEqual(item);

  await updateItem(item.id, { ...ITEM_FIELDS, description: 'Updated description' }, USER);
  expect((await getItem(item.id, USER))?.description).toBe('Updated description');
});

test('it returns no item for an unknown id', async () => {
  expect(await getItem('this-id-does-not-exist', USER)).toBeUndefined();
});

test('it can store multiple items', async () => {
  const item2 = makeItem({ id: 'second-item-id', name: 'Second item' });
  await storeItem(ITEM);
  await storeItem(item2);

  const items = await getItems(USER);
  expect(items).toHaveLength(2);
  expect(items).toContainEqual(ITEM);
  expect(items).toContainEqual(item2);
});

test('it only updates the selected item', async () => {
  const item2 = makeItem({ id: 'second-item-id', name: 'Second item' });
  await storeItem(ITEM);
  await storeItem(item2);

  await updateItem(ITEM.id, { ...ITEM_FIELDS, completed: true }, USER);

  const items = await getItems(USER);
  expect(items).toContainEqual({ ...ITEM, completed: true });
  expect(items).toContainEqual(item2);
});

test('it only removes the selected item', async () => {
  const item2 = makeItem({ id: 'second-item-id', name: 'Second item' });
  await storeItem(ITEM);
  await storeItem(item2);

  await removeItem(ITEM.id, USER);

  expect(await getItems(USER)).toEqual([item2]);
});

describe('user scoping', () => {
  const foreign = makeItem({ id: 'foreign-id', userId: OTHER_USER, projectId: OTHER_PROJECT, name: 'Foreign' });

  beforeEach(async () => {
    await storeItem(ITEM);
    await storeItem(foreign);
  });

  test('getItems only returns the caller items', async () => {
    expect(await getItems(USER)).toEqual([ITEM]);
    expect(await getItems(OTHER_USER)).toEqual([foreign]);
  });

  test('getItem does not return another user item', async () => {
    expect(await getItem(foreign.id, USER)).toBeUndefined();
  });

  test('updateItem does not touch another user item', async () => {
    expect(await updateItem(foreign.id, { ...ITEM_FIELDS, name: 'pwned' }, USER)).toBe(0);
    expect((await getItem(foreign.id, OTHER_USER))?.name).toBe('Foreign');
  });

  test('removeItem does not delete another user item', async () => {
    expect(await removeItem(foreign.id, USER)).toBe(0);
    expect(await getItem(foreign.id, OTHER_USER)).toEqual(foreign);
  });
});

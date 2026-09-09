import { jest } from '@jest/globals';

const persistence = {
  getItems: jest.fn(),
  getItem: jest.fn(),
  storeItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
};
const uuid = jest.fn();

jest.unstable_mockModule('@service/item.service.js', () => ({ itemService: persistence }));
jest.unstable_mockModule('uuid', () => ({ v4: uuid }));

const { Hono } = await import('hono');
const { itemController } = await import('@controller/item.controller.js');
const db = persistence;

const app = new Hono();
app.route('/items', itemController);

const get = () => app.request('/items');

const post = (body: unknown) =>
  app.request('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const put = (id: string, body: unknown) =>
  app.request(`/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const del = (id: string) => app.request(`/items/${id}`, { method: 'DELETE' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /items', () => {
  const ITEMS = [{ id: 12345 }];

  test('it gets items correctly', async () => {
    db.getItems.mockReturnValue(Promise.resolve(ITEMS));

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(ITEMS);
  });

  test('it returns an empty list when there are no items', async () => {
    db.getItems.mockReturnValue(Promise.resolve([]));

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual([]);
  });

  test('it returns multiple items correctly', async () => {
    const items = [
      { id: 1, name: 'First item', completed: false },
      { id: 2, name: 'Second item', completed: true },
      { id: 3, name: 'Third item', completed: false },
    ];

    db.getItems.mockReturnValue(Promise.resolve(items));

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(items);
  });

  test('it returns items with an empty name', async () => {
    const items = [{ id: 1, name: '', completed: false }];

    db.getItems.mockReturnValue(Promise.resolve(items));

    const res = await get();

    expect(await res.json()).toEqual(items);
  });

  test('it returns completed and incomplete items', async () => {
    const items = [
      { id: 1, name: 'Completed task', completed: true },
      { id: 2, name: 'Pending task', completed: false },
    ];

    db.getItems.mockReturnValue(Promise.resolve(items));

    const res = await get();

    expect(await res.json()).toEqual(items);
  });
});

describe('POST /items', () => {
  test('it stores item correctly', async () => {
    const id = 'something-not-a-uuid';
    const name = 'A sample item';

    uuid.mockReturnValue(id);

    const res = await post({ name });

    const expectedItem = { id, name, completed: false };

    expect(db.storeItem).toHaveBeenCalledTimes(1);
    expect(db.storeItem).toHaveBeenCalledWith(expectedItem);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expectedItem);
  });

  test('it can create an item with an empty name', async () => {
    const id = 'empty-name-id';

    uuid.mockReturnValue(id);

    const res = await post({ name: '' });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name: '',
      completed: false,
    });

    expect(await res.json()).toEqual({
      id,
      name: '',
      completed: false,
    });
  });

  test('it can create an item with a long name', async () => {
    const id = 'long-name-id';
    const name = 'A'.repeat(500);

    uuid.mockReturnValue(id);

    await post({ name });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name,
      completed: false,
    });
  });

  test('it can create an item with special characters', async () => {
    const id = 'special-character-id';
    const name = 'Test @#$%éà !?';

    uuid.mockReturnValue(id);

    await post({ name });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name,
      completed: false,
    });
  });

  test('it can create an item with spaces in the name', async () => {
    const id = 'spaces-id';
    const name = '   Test item   ';

    uuid.mockReturnValue(id);

    await post({ name });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name,
      completed: false,
    });
  });
});

describe('PUT /items/:id', () => {
  const ITEM = { id: 12345 };

  test('it updates items correctly', async () => {
    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    const res = await put('1234', { name: 'New title', completed: false });

    expect(db.updateItem).toHaveBeenCalledTimes(1);
    expect(db.updateItem).toHaveBeenCalledWith('1234', {
      name: 'New title',
      completed: false,
    });

    expect(db.getItem).toHaveBeenCalledTimes(1);
    expect(db.getItem).toHaveBeenCalledWith('1234');

    expect(await res.json()).toEqual(ITEM);
  });

  test('it updates an item with an empty name', async () => {
    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    const res = await put('1234', { name: '', completed: false });

    expect(db.updateItem).toHaveBeenCalledWith('1234', {
      name: '',
      completed: false,
    });

    expect(await res.json()).toEqual(ITEM);
  });

  test('it can mark an item as completed', async () => {
    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await put('1234', { name: 'Finished task', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith('1234', {
      name: 'Finished task',
      completed: true,
    });
  });

  test('it updates an item with a very long name', async () => {
    const longName = 'A'.repeat(500);

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await put('1234', { name: longName, completed: false });

    expect(db.updateItem).toHaveBeenCalledWith('1234', {
      name: longName,
      completed: false,
    });
  });

  test('it updates an item with special characters', async () => {
    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await put('1234', { name: 'Tâche @#$% éà !?', completed: false });

    expect(db.updateItem).toHaveBeenCalledWith('1234', {
      name: 'Tâche @#$% éà !?',
      completed: false,
    });
  });

  test('it updates an item with a string id', async () => {
    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await put('abc-123', { name: 'Updated item', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith('abc-123', {
      name: 'Updated item',
      completed: true,
    });

    expect(db.getItem).toHaveBeenCalledWith('abc-123');
  });
});

describe('DELETE /items/:id', () => {
  test('it removes item correctly', async () => {
    const res = await del('12345');

    expect(db.removeItem).toHaveBeenCalledTimes(1);
    expect(db.removeItem).toHaveBeenCalledWith('12345');
    expect(res.status).toBe(200);
  });

  test('it removes item with a string id', async () => {
    const res = await del('abc-123');

    expect(db.removeItem).toHaveBeenCalledWith('abc-123');
    expect(res.status).toBe(200);
  });

  test('it removes item with a long id', async () => {
    const id = 'a'.repeat(500);
    const res = await del(id);

    expect(db.removeItem).toHaveBeenCalledWith(id);
    expect(res.status).toBe(200);
  });

  test('it only calls removeItem once', async () => {
    await del('12345');

    expect(db.removeItem).toHaveBeenCalledTimes(1);
  });
});

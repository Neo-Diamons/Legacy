import { jest } from '@jest/globals';

const persistence = {
  getItem: jest.fn(),
  updateItem: jest.fn(),
};

jest.unstable_mockModule('@service/item.service.js', () => ({ itemService: persistence }));

const { Hono } = await import('hono');
const { default: updateItem } = await import('../../routes/updateItem.js');
const db = persistence;

const app = new Hono();
app.put('/items/:id', updateItem);

const put = (id: string, body: unknown) =>
  app.request(`/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const ITEM = { id: 12345 };

beforeEach(() => {
  jest.clearAllMocks();
});

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

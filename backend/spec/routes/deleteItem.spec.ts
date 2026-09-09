import { jest } from '@jest/globals';

const persistence = { removeItem: jest.fn() };

jest.unstable_mockModule('../../persistence/index.js', () => persistence);

const { Hono } = await import('hono');
const { default: deleteItem } = await import('../../routes/deleteItem.js');
const db = persistence;

const app = new Hono();
app.delete('/items/:id', deleteItem);

const del = (id: string) => app.request(`/items/${id}`, { method: 'DELETE' });

beforeEach(() => {
  jest.clearAllMocks();
});

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

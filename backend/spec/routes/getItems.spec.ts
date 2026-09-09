import { jest } from '@jest/globals';

const persistence = { getItems: jest.fn() };

jest.unstable_mockModule('../../persistence/index.js', () => persistence);

const { Hono } = await import('hono');
const { default: getItems } = await import('../../routes/getItems.js');
const db = persistence;

const app = new Hono();
app.get('/items', getItems);

const get = () => app.request('/items');

const ITEMS = [{ id: 12345 }];

beforeEach(() => {
  jest.clearAllMocks();
});

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

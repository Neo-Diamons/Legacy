import { jest } from '@jest/globals';

const persistence = { storeItem: jest.fn() };
const uuid = jest.fn();

jest.unstable_mockModule('../../service/item.service.js', () => ({ itemService: persistence }));
jest.unstable_mockModule('uuid', () => ({ v4: uuid }));

const { Hono } = await import('hono');
const { default: addItem } = await import('../../routes/addItem.js');
const db = persistence;

const app = new Hono();
app.post('/items', addItem);

const post = (body: unknown) =>
  app.request('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
});

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

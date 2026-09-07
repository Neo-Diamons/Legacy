import { jest } from '@jest/globals';

const persistence = { storeItem: jest.fn() };
const uuid = jest.fn();

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);
jest.unstable_mockModule('uuid', () => ({ v4: uuid }));

const { default: addItem } = await import('../../src/routes/addItem.js');
const { storeItem: _storeItem } = persistence;
const db = persistence;

beforeEach(() => {
  jest.clearAllMocks();
});

test('it stores item correctly', async () => {
  const id = 'something-not-a-uuid';
  const name = 'A sample item';
  const req = { body: { name } };
  const res = { send: jest.fn() };

  uuid.mockReturnValue(id);

  await addItem(req, res);

  const expectedItem = { id, name, completed: false };

  expect(_storeItem.mock.calls.length).toBe(1);
  expect(_storeItem.mock.calls[0][0]).toEqual(expectedItem);
  expect(res.send.mock.calls[0].length).toBe(1);
  expect(res.send.mock.calls[0][0]).toEqual(expectedItem);
});

test('it can create an item with an empty name', async () => {
  const id = 'empty-name-id';
  const req = { body: { name: '' } };
  const res = { send: jest.fn() };

  uuid.mockReturnValue(id);

  await addItem(req, res);

  expect(db.storeItem).toHaveBeenCalledWith({
    id,
    name: '',
    completed: false,
  });

  expect(res.send).toHaveBeenCalledWith({
    id,
    name: '',
    completed: false,
  });
});

test('it can create an item with a long name', async () => {
  const id = 'long-name-id';
  const name = 'A'.repeat(500);
  const req = { body: { name } };
  const res = { send: jest.fn() };

  uuid.mockReturnValue(id);

  await addItem(req, res);

  expect(db.storeItem).toHaveBeenCalledWith({
    id,
    name,
    completed: false,
  });
});

test('it can create an item with special characters', async () => {
  const id = 'special-character-id';
  const name = 'Test @#$%éà !?';
  const req = { body: { name } };
  const res = { send: jest.fn() };

  uuid.mockReturnValue(id);

  await addItem(req, res);

  expect(db.storeItem).toHaveBeenCalledWith({
    id,
    name,
    completed: false,
  });
});

test('it can create an item with spaces in the name', async () => {
  const id = 'spaces-id';
  const name = '   Test item   ';
  const req = { body: { name } };
  const res = { send: jest.fn() };

  uuid.mockReturnValue(id);

  await addItem(req, res);

  expect(db.storeItem).toHaveBeenCalledWith({
    id,
    name,
    completed: false,
  });
});

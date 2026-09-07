import { jest } from '@jest/globals';

const persistence = { removeItem: jest.fn() };

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: deleteItem } = await import('../../src/routes/deleteItem.js');
const { removeItem: _removeItem } = persistence;
const db = persistence;
const ITEM = { id: 12345 };

beforeEach(() => {
    jest.clearAllMocks();
});

test('it removes item correctly', async () => {
    const req = { params: { id: 12345 } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(_removeItem.mock.calls.length).toBe(1);
    expect(_removeItem.mock.calls[0][0]).toBe(req.params.id);
    expect(res.sendStatus.mock.calls[0].length).toBe(1);
    expect(res.sendStatus.mock.calls[0][0]).toBe(200);
});

test('it removes item with a string id', async () => {
    const req = { params: { id: 'abc-123' } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(db.removeItem).toHaveBeenCalledWith('abc-123');
    expect(res.sendStatus).toHaveBeenCalledWith(200);
});

test('it removes item with an empty id', async () => {
    const req = { params: { id: '' } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(db.removeItem).toHaveBeenCalledWith('');
    expect(res.sendStatus).toHaveBeenCalledWith(200);
});

test('it removes item with a long id', async () => {
    const id = 'a'.repeat(500);
    const req = { params: { id } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(db.removeItem).toHaveBeenCalledWith(id);
    expect(res.sendStatus).toHaveBeenCalledWith(200);
});

test('it only calls removeItem once', async () => {
    const req = { params: { id: 12345 } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(db.removeItem).toHaveBeenCalledTimes(1);
});

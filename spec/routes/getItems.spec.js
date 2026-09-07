import { jest } from '@jest/globals';

const persistence = { getItems: jest.fn() };

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: getItems } = await import('../../src/routes/getItems.js');
const { getItems: _getItems } = persistence;
const db = persistence;
const ITEMS = [{ id: 12345 }];

beforeEach(() => {
    jest.clearAllMocks();
});

test('it gets items correctly', async () => {
    const req = {};
    const res = { send: jest.fn() };
    _getItems.mockReturnValue(Promise.resolve(ITEMS));

    await getItems(req, res);

    expect(_getItems.mock.calls.length).toBe(1);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEMS);
});

test('it returns an empty list when there are no items', async () => {
    const req = {};
    const res = { send: jest.fn() };

    db.getItems.mockReturnValue(Promise.resolve([]));

    await getItems(req, res);

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith([]);
});

test('it returns multiple items correctly', async () => {
    const items = [
        { id: 1, name: 'First item', completed: false },
        { id: 2, name: 'Second item', completed: true },
        { id: 3, name: 'Third item', completed: false },
    ];

    const req = {};
    const res = { send: jest.fn() };

    db.getItems.mockReturnValue(Promise.resolve(items));

    await getItems(req, res);

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(items);
});

test('it returns items with an empty name', async () => {
    const items = [
        { id: 1, name: '', completed: false },
    ];

    const req = {};
    const res = { send: jest.fn() };

    db.getItems.mockReturnValue(Promise.resolve(items));

    await getItems(req, res);

    expect(res.send).toHaveBeenCalledWith(items);
});

test('it returns completed and incomplete items', async () => {
    const items = [
        { id: 1, name: 'Completed task', completed: true },
        { id: 2, name: 'Pending task', completed: false },
    ];

    const req = {};
    const res = { send: jest.fn() };

    db.getItems.mockReturnValue(Promise.resolve(items));

    await getItems(req, res);

    expect(res.send).toHaveBeenCalledWith(items);
});

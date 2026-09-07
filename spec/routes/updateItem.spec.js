import { jest } from '@jest/globals';

const persistence = {
    getItem: jest.fn(),
    updateItem: jest.fn(),
};

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: updateItem } = await import('../../src/routes/updateItem.js');
const { getItem: _getItem, updateItem: _updateItem } = persistence;
const db = persistence;
const ITEM = { id: 12345 };

beforeEach(() => {
    jest.clearAllMocks();
});

test('it updates items correctly', async () => {
    const req = {
        params: { id: 1234 },
        body: { name: 'New title', completed: false },
    };
    const res = { send: jest.fn() };

    _getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(_updateItem.mock.calls.length).toBe(1);
    expect(_updateItem.mock.calls[0][0]).toBe(req.params.id);
    expect(_updateItem.mock.calls[0][1]).toEqual({
        name: 'New title',
        completed: false,
    });

    expect(_getItem.mock.calls.length).toBe(1);
    expect(_getItem.mock.calls[0][0]).toBe(req.params.id);

    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEM);
});

test('it updates an item with an empty name', async () => {
    const req = {
        params: { id: 1234 },
        body: { name: '', completed: false },
    };
    const res = { send: jest.fn() };

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(db.updateItem).toHaveBeenCalledWith(1234, {
        name: '',
        completed: false,
    });

    expect(res.send).toHaveBeenCalledWith(ITEM);
});

test('it can mark an item as completed', async () => {
    const req = {
        params: { id: 1234 },
        body: { name: 'Finished task', completed: true },
    };
    const res = { send: jest.fn() };

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(db.updateItem).toHaveBeenCalledWith(1234, {
        name: 'Finished task',
        completed: true,
    });
});

test('it updates an item with a very long name', async () => {
    const longName = 'A'.repeat(500);

    const req = {
        params: { id: 1234 },
        body: { name: longName, completed: false },
    };
    const res = { send: jest.fn() };

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(db.updateItem).toHaveBeenCalledWith(1234, {
        name: longName,
        completed: false,
    });
});

test('it updates an item with special characters', async () => {
    const req = {
        params: { id: 1234 },
        body: {
            name: 'Tâche @#$% éà !?',
            completed: false,
        },
    };
    const res = { send: jest.fn() };

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(db.updateItem).toHaveBeenCalledWith(1234, {
        name: 'Tâche @#$% éà !?',
        completed: false,
    });
});

test('it updates an item with a string id', async () => {
    const req = {
        params: { id: 'abc-123' },
        body: { name: 'Updated item', completed: true },
    };
    const res = { send: jest.fn() };

    db.getItem.mockReturnValue(Promise.resolve(ITEM));

    await updateItem(req, res);

    expect(db.updateItem).toHaveBeenCalledWith('abc-123', {
        name: 'Updated item',
        completed: true,
    });

    expect(db.getItem).toHaveBeenCalledWith('abc-123');
});

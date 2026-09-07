import { jest } from '@jest/globals';

const persistence = {
    getItem: jest.fn(),
    updateItem: jest.fn(),
};

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: updateItem } = await import('../../src/routes/updateItem.js');
const { getItem: _getItem, updateItem: _updateItem } = persistence;
const ITEM = { id: 12345 };

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

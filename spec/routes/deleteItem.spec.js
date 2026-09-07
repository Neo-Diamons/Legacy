import { jest } from '@jest/globals';

const persistence = { removeItem: jest.fn() };

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: deleteItem } = await import('../../src/routes/deleteItem.js');
const { removeItem: _removeItem } = persistence;
const ITEM = { id: 12345 };

test('it removes item correctly', async () => {
    const req = { params: { id: 12345 } };
    const res = { sendStatus: jest.fn() };

    await deleteItem(req, res);

    expect(_removeItem.mock.calls.length).toBe(1);
    expect(_removeItem.mock.calls[0][0]).toBe(req.params.id);
    expect(res.sendStatus.mock.calls[0].length).toBe(1);
    expect(res.sendStatus.mock.calls[0][0]).toBe(200);
});

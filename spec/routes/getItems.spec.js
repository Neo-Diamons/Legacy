import { jest } from '@jest/globals';

const persistence = { getItems: jest.fn() };

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);

const { default: getItems } = await import('../../src/routes/getItems.js');
const { getItems: _getItems } = persistence;
const ITEMS = [{ id: 12345 }];

test('it gets items correctly', async () => {
    const req = {};
    const res = { send: jest.fn() };
    _getItems.mockReturnValue(Promise.resolve(ITEMS));

    await getItems(req, res);

    expect(_getItems.mock.calls.length).toBe(1);
    expect(res.send.mock.calls[0].length).toBe(1);
    expect(res.send.mock.calls[0][0]).toEqual(ITEMS);
});

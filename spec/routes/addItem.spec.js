import { jest } from '@jest/globals';

const persistence = { storeItem: jest.fn() };
const uuid = jest.fn();

jest.unstable_mockModule('../../src/persistence/index.js', () => persistence);
jest.unstable_mockModule('uuid', () => ({ v4: uuid }));

const { default: addItem } = await import('../../src/routes/addItem.js');
const { storeItem: _storeItem } = persistence;
const ITEM = { id: 12345 };

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

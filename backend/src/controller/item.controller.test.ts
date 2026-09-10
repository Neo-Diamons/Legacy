import { vi } from 'vitest';
import { ItemListSchema, ItemResponseSchema } from '@schemas/item.schemas.js';

const { persistence, uuid } = vi.hoisted(() => ({
  persistence: {
    getItems: vi.fn(),
    getItem: vi.fn(),
    storeItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
  },
  uuid: vi.fn(),
}));

vi.mock('@service/item.service.js', () => ({ itemService: persistence }));

const { itemController } = await import('@controller/item.controller.js');
const { createRouter, registerErrorHandler } = await import('@http/app.js');
const db = persistence;

const app = createRouter();
app.route('/items', itemController);
registerErrorHandler(app);

const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const ID2 = '11111111-1111-4111-8111-111111111111';
const ID3 = '22222222-2222-4222-8222-222222222222';
const ID4 = '33333333-3333-4333-8333-333333333333';

const get = () => app.request('/items');

const post = (body: unknown) =>
  app.request('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const put = (id: string, body: unknown) =>
  app.request(`/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const del = (id: string) => app.request(`/items/${id}`, { method: 'DELETE' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => uuid());
});

describe('GET /items', () => {
  const ITEMS = [{ id: ID, name: 'A sample item', completed: false }];

  test('it gets items correctly', async () => {
    db.getItems.mockResolvedValue(ITEMS);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(ITEMS);
  });

  test('it returns an empty list when there are no items', async () => {
    db.getItems.mockResolvedValue([]);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual([]);
  });

  test('it returns multiple items correctly', async () => {
    const items = [
      { id: ID, name: 'First item', completed: false },
      { id: ID2, name: 'Second item', completed: true },
      { id: ID3, name: 'Third item', completed: false },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(items);
  });

  test('it returns items with an empty name', async () => {
    const items = [{ id: ID, name: '', completed: false }];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual(items);
  });

  test('it returns completed and incomplete items', async () => {
    const items = [
      { id: ID, name: 'Completed task', completed: true },
      { id: ID2, name: 'Pending task', completed: false },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual(items);
  });

  test('the response body conforms to ItemListSchema', async () => {
    db.getItems.mockResolvedValue([
      { id: ID, name: 'A sample item', completed: false },
      { id: ID2, name: 'Another item', completed: true },
    ]);

    const res = await get();
    const body = await res.json();

    expect(() => ItemListSchema.parse(body)).not.toThrow();
  });
});

describe('POST /items', () => {
  test('it stores item correctly', async () => {
    const id = ID;
    const name = 'A sample item';

    uuid.mockReturnValue(id);

    const res = await post({ name });

    const expectedItem = { id, name, completed: false };

    expect(db.storeItem).toHaveBeenCalledTimes(1);
    expect(db.storeItem).toHaveBeenCalledWith(expectedItem);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(expectedItem);
  });

  test('it can create an item with an empty name', async () => {
    const id = ID2;

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
    const id = ID3;
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
    const id = ID4;
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
    const id = ID;
    const name = '   Test item   ';

    uuid.mockReturnValue(id);

    await post({ name });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name,
      completed: false,
    });
  });

  test('the response body conforms to ItemResponseSchema', async () => {
    uuid.mockReturnValue(ID);

    const res = await post({ name: 'A sample item' });
    const body = await res.json();

    expect(() => ItemResponseSchema.parse(body)).not.toThrow();
  });
});

describe('PUT /items/:id', () => {
  beforeEach(() => {
    db.updateItem.mockResolvedValue(1);
  });

  test('it updates items correctly', async () => {
    const res = await put(ID, { name: 'New title', completed: false });

    expect(db.updateItem).toHaveBeenCalledTimes(1);
    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'New title',
      completed: false,
    });

    expect(await res.json()).toEqual({ id: ID, name: 'New title', completed: false });
  });

  test('the response body conforms to ItemResponseSchema', async () => {
    const res = await put(ID, { name: 'New title', completed: true });
    const body = await res.json();

    expect(() => ItemResponseSchema.parse(body)).not.toThrow();
  });

  test('it updates an item with an empty name', async () => {
    const res = await put(ID, { name: '', completed: false });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: '',
      completed: false,
    });

    expect(await res.json()).toEqual({ id: ID, name: '', completed: false });
  });

  test('it can mark an item as completed', async () => {
    await put(ID, { name: 'Finished task', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Finished task',
      completed: true,
    });
  });

  test('it updates an item with a very long name', async () => {
    const longName = 'A'.repeat(500);

    await put(ID, { name: longName, completed: false });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: longName,
      completed: false,
    });
  });

  test('it updates an item with special characters', async () => {
    await put(ID, { name: 'Tâche @#$% éà !?', completed: false });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Tâche @#$% éà !?',
      completed: false,
    });
  });

  test('it accepts any valid uuid id', async () => {
    await put(ID2, { name: 'Updated item', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith(ID2, {
      name: 'Updated item',
      completed: true,
    });
  });

  test('it rejects a non-uuid id with 422', async () => {
    const res = await put('abc-123', { name: 'x', completed: false });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      message: 'Validation failed',
      issues: [{ path: ['id'], message: expect.any(String) }],
    });
    expect(db.updateItem).not.toHaveBeenCalled();
  });

  test('it returns 404 when the item does not exist', async () => {
    db.updateItem.mockResolvedValue(0);

    const res = await put(ID, { name: 'x', completed: false });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Item not found' });
    expect(db.updateItem).toHaveBeenCalledWith(ID, { name: 'x', completed: false });
  });

  test('it rejects a missing completed field with 422', async () => {
    const res = await put(ID, { name: 'x' });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      message: 'Validation failed',
      issues: [{ path: ['completed'], message: expect.any(String) }],
    });
    expect(db.updateItem).not.toHaveBeenCalled();
  });
});

describe('DELETE /items/:id', () => {
  beforeEach(() => {
    db.removeItem.mockResolvedValue(1);
  });

  test('it removes item correctly', async () => {
    const res = await del(ID);

    expect(db.removeItem).toHaveBeenCalledTimes(1);
    expect(db.removeItem).toHaveBeenCalledWith(ID);
    expect(res.status).toBe(204);
  });

  test('it removes an item for any valid uuid id', async () => {
    const res = await del(ID2);

    expect(db.removeItem).toHaveBeenCalledWith(ID2);
    expect(res.status).toBe(204);
  });

  test('it rejects a non-uuid id with 422', async () => {
    const res = await del('a'.repeat(500));

    expect(res.status).toBe(422);
    expect(db.removeItem).not.toHaveBeenCalled();
  });

  test('it returns 404 when the item does not exist', async () => {
    db.removeItem.mockResolvedValue(0);

    const res = await del(ID);

    expect(res.status).toBe(404);
    expect(db.removeItem).toHaveBeenCalledWith(ID);
  });

  test('it only calls removeItem once', async () => {
    await del(ID);

    expect(db.removeItem).toHaveBeenCalledTimes(1);
  });
});

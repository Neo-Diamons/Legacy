import { vi } from 'vitest';
import { ItemListResponseSchema, ItemResponseSchema } from '@schemas/item.schemas.js';

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

const get = (query = '') => app.request(`/items${query}`);

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

const FIXED_CREATED_AT = '2026-01-01T00:00:00.000Z';
const FIXED_CREATED_AT_DATE = new Date(FIXED_CREATED_AT);

describe('GET /items', () => {
  const ITEMS = [
    {
      id: ID,
      name: 'A sample item',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
    },
  ];

  test('it gets items correctly', async () => {
    db.getItems.mockResolvedValue(ITEMS);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual([{ ...ITEMS[0], dueDate: null, createdAt: FIXED_CREATED_AT, overdue: false }]);
  });

  test('it returns an empty list when there are no items', async () => {
    db.getItems.mockResolvedValue([]);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual([]);
  });

  test('it returns multiple items correctly', async () => {
    const items = [
      {
        id: ID,
        name: 'First item',
        completed: false,
        priority: 'low',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
      {
        id: ID2,
        name: 'Second item',
        completed: true,
        priority: 'high',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
      {
        id: ID3,
        name: 'Third item',
        completed: false,
        priority: 'urgent',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(db.getItems).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual(
      items.map((item) => ({ ...item, dueDate: null, createdAt: FIXED_CREATED_AT, overdue: false }))
    );
  });

  test('it returns items with an empty name', async () => {
    const items = [
      {
        id: ID,
        name: '',
        completed: false,
        priority: 'medium',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual(
      items.map((item) => ({ ...item, dueDate: null, createdAt: FIXED_CREATED_AT, overdue: false }))
    );
  });

  test('it returns completed and incomplete items', async () => {
    const items = [
      {
        id: ID,
        name: 'Completed task',
        completed: true,
        priority: 'medium',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
      {
        id: ID2,
        name: 'Pending task',
        completed: false,
        priority: 'medium',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual(
      items.map((item) => ({ ...item, dueDate: null, createdAt: FIXED_CREATED_AT, overdue: false }))
    );
  });

  test('it flags an item with a past due date and not completed as overdue', async () => {
    const items = [
      {
        id: ID,
        name: 'Late task',
        completed: false,
        priority: 'medium',
        description: null,
        dueDate: new Date('2020-01-01T00:00:00.000Z'),
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual([
      {
        id: ID,
        name: 'Late task',
        completed: false,
        priority: 'medium',
        description: null,
        dueDate: '2020-01-01T00:00:00.000Z',
        createdAt: FIXED_CREATED_AT,
        overdue: true,
      },
    ]);
  });

  test('it does not flag a completed item with a past due date as overdue', async () => {
    const items = [
      {
        id: ID,
        name: 'Late but done',
        completed: true,
        priority: 'medium',
        description: null,
        dueDate: new Date('2020-01-01T00:00:00.000Z'),
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ];

    db.getItems.mockResolvedValue(items);

    const res = await get();

    expect(await res.json()).toEqual([
      {
        id: ID,
        name: 'Late but done',
        completed: true,
        priority: 'medium',
        description: null,
        dueDate: '2020-01-01T00:00:00.000Z',
        createdAt: FIXED_CREATED_AT,
        overdue: false,
      },
    ]);
  });

  test('it forwards sort/filter query params to the service', async () => {
    db.getItems.mockResolvedValue([]);

    await get('?sortBy=dueDate&sortOrder=asc&priority=high&filter=today');

    expect(db.getItems).toHaveBeenCalledWith({
      sortBy: 'dueDate',
      sortOrder: 'asc',
      priority: 'high',
      filter: 'today',
    });
  });

  test('it rejects an unknown query param with 422', async () => {
    const res = await get('?bogus=1');

    expect(res.status).toBe(422);
    expect(db.getItems).not.toHaveBeenCalled();
  });

  test('the response body conforms to ItemListResponseSchema', async () => {
    db.getItems.mockResolvedValue([
      {
        id: ID,
        name: 'A sample item',
        completed: false,
        priority: 'medium',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
      {
        id: ID2,
        name: 'Another item',
        completed: true,
        priority: 'low',
        description: null,
        dueDate: null,
        createdAt: FIXED_CREATED_AT_DATE,
      },
    ]);

    const res = await get();
    const body = await res.json();

    expect(() => ItemListResponseSchema.parse(body)).not.toThrow();
  });
});

describe('POST /items', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_CREATED_AT));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('it stores item correctly', async () => {
    const id = ID;
    const name = 'A sample item';

    uuid.mockReturnValue(id);

    const res = await post({ name });

    const expectedItem = {
      id,
      name,
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
    };

    expect(db.storeItem).toHaveBeenCalledTimes(1);
    expect(db.storeItem).toHaveBeenCalledWith(expectedItem);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...expectedItem, createdAt: FIXED_CREATED_AT, overdue: false });
  });

  test('it can create an item with an empty name', async () => {
    const id = ID2;

    uuid.mockReturnValue(id);

    const res = await post({ name: '' });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name: '',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
    });

    expect(await res.json()).toEqual({
      id,
      name: '',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT,
      overdue: false,
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
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
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
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
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
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
    });
  });

  test('it can create an item with an explicit priority and due date', async () => {
    const id = ID;

    uuid.mockReturnValue(id);

    const res = await post({ name: 'Ship release', priority: 'urgent', dueDate: '2026-09-20T15:00:00.000Z' });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name: 'Ship release',
      completed: false,
      priority: 'urgent',
      description: null,
      dueDate: new Date('2026-09-20T15:00:00.000Z'),
      createdAt: FIXED_CREATED_AT_DATE,
    });

    expect(await res.json()).toEqual({
      id,
      name: 'Ship release',
      completed: false,
      priority: 'urgent',
      description: null,
      dueDate: '2026-09-20T15:00:00.000Z',
      createdAt: FIXED_CREATED_AT,
      overdue: false,
    });
  });

  test('it can create an item with a description', async () => {
    const id = ID;

    uuid.mockReturnValue(id);

    const res = await post({ name: 'Buy milk', description: 'Whole or oat, whichever is cheaper' });

    expect(db.storeItem).toHaveBeenCalledWith({
      id,
      name: 'Buy milk',
      completed: false,
      priority: 'medium',
      description: 'Whole or oat, whichever is cheaper',
      dueDate: null,
      createdAt: FIXED_CREATED_AT_DATE,
    });

    expect(await res.json()).toEqual({
      id,
      name: 'Buy milk',
      completed: false,
      priority: 'medium',
      description: 'Whole or oat, whichever is cheaper',
      dueDate: null,
      createdAt: FIXED_CREATED_AT,
      overdue: false,
    });
  });

  test('it rejects an invalid priority with 422', async () => {
    const res = await post({ name: 'x', priority: 'critical' });

    expect(res.status).toBe(422);
    expect(db.storeItem).not.toHaveBeenCalled();
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
    db.getItem.mockImplementation(async (id: string) => {
      const [, update] = db.updateItem.mock.calls.at(-1) ?? [];
      return {
        id,
        name: update?.name ?? 'Existing item',
        completed: update?.completed ?? false,
        priority: update?.priority ?? 'medium',
        description: update?.description ?? null,
        dueDate: update?.dueDate ?? null,
        createdAt: new Date(FIXED_CREATED_AT),
      };
    });
  });

  test('it updates items correctly', async () => {
    const res = await put(ID, { name: 'New title', completed: false });

    expect(db.updateItem).toHaveBeenCalledTimes(1);
    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'New title',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
    });

    expect(await res.json()).toEqual({
      id: ID,
      name: 'New title',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT,
      overdue: false,
    });
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
      priority: 'medium',
      description: null,
      dueDate: null,
    });

    expect(await res.json()).toEqual({
      id: ID,
      name: '',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
      createdAt: FIXED_CREATED_AT,
      overdue: false,
    });
  });

  test('it can mark an item as completed', async () => {
    await put(ID, { name: 'Finished task', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Finished task',
      completed: true,
      priority: 'medium',
      description: null,
      dueDate: null,
    });
  });

  test('it updates an item with a very long name', async () => {
    const longName = 'A'.repeat(500);

    await put(ID, { name: longName, completed: false });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: longName,
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
    });
  });

  test('it updates an item with special characters', async () => {
    await put(ID, { name: 'Tâche @#$% éà !?', completed: false });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Tâche @#$% éà !?',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
    });
  });

  test('it accepts any valid uuid id', async () => {
    await put(ID2, { name: 'Updated item', completed: true });

    expect(db.updateItem).toHaveBeenCalledWith(ID2, {
      name: 'Updated item',
      completed: true,
      priority: 'medium',
      description: null,
      dueDate: null,
    });
  });

  test('it updates an item with an explicit priority and due date', async () => {
    await put(ID, { name: 'Ship release', completed: false, priority: 'urgent', dueDate: '2026-09-20T15:00:00.000Z' });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Ship release',
      completed: false,
      priority: 'urgent',
      description: null,
      dueDate: new Date('2026-09-20T15:00:00.000Z'),
    });
  });

  test('it can clear a due date by passing null', async () => {
    await put(ID, { name: 'No date', completed: false, priority: 'low', dueDate: null });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'No date',
      completed: false,
      priority: 'low',
      description: null,
      dueDate: null,
    });
  });

  test('it can set a description', async () => {
    await put(ID, { name: 'Buy milk', completed: false, description: 'Oat milk this time' });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Buy milk',
      completed: false,
      priority: 'medium',
      description: 'Oat milk this time',
      dueDate: null,
    });
  });

  test('it can clear a description by passing null', async () => {
    await put(ID, { name: 'Buy milk', completed: false, description: null });

    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'Buy milk',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
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
    expect(db.updateItem).toHaveBeenCalledWith(ID, {
      name: 'x',
      completed: false,
      priority: 'medium',
      description: null,
      dueDate: null,
    });
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

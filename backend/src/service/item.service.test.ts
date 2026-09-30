import { itemService } from '@service/item.service.js';
import { resetDb } from '../test/db.js';
import { seedItem, seedProject, seedUser } from '../test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
const { storeItem, getItems, getItem, updateItem, removeItem } = itemService;

let alice: Session;
let bob: Session;
let aliceProject: string;
let bobProject: string;

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
  bob = await seedUser('bob@example.com');
  aliceProject = await seedProject(alice.id);
  bobProject = await seedProject(bob.id);
});

afterEach(() => {
  vi.useRealTimers();
});

const names = async (userId: string, options?: Parameters<typeof getItems>[1]) =>
  (await getItems(userId, options)).map((i) => i.name);

const fields = (item: Awaited<ReturnType<typeof seedItem>>) => ({
  name: item.name,
  description: item.description,
  completed: item.completed,
  priority: item.priority,
  dueDate: item.dueDate,
});

describe('storeItem / getItem / getItems', () => {
  it('stores an item and returns it unchanged', async () => {
    const item = await seedItem(alice.id, aliceProject, {
      name: 'Buy milk',
      description: 'Oat',
      priority: 'high',
      completed: true,
      dueDate: new Date('2026-10-01T10:00:00.000Z'),
    });

    expect(await getItem(item.id, alice.id)).toEqual(item);
    expect(await getItems(alice.id)).toEqual([item]);
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a very long name', { name: 'A'.repeat(1000) }],
    ['special characters', { name: `Robert'); DROP TABLE todo_items;-- <b>é日本語🚀</b>` }],
    ['a multi-line description', { description: 'line 1\nline 2\n\ttabbed' }],
  ])('round-trips an item with %s', async (_label, overrides) => {
    const item = await seedItem(alice.id, aliceProject, overrides);
    expect(await getItem(item.id, alice.id)).toEqual(item);
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getItem(crypto.randomUUID(), alice.id)).toBeUndefined();
  });

  it('returns an empty list when the user has no items', async () => {
    expect(await getItems(alice.id)).toEqual([]);
  });

  it('refuses an item pointing to a project that does not exist', async () => {
    await expect(
      storeItem({
        id: crypto.randomUUID(),
        userId: alice.id,
        projectId: crypto.randomUUID(),
        name: 'x',
        description: null,
        completed: false,
        priority: 'medium',
        dueDate: null,
        createdAt: new Date(),
      })
    ).rejects.toThrow();
  });

  it('refuses a duplicate id', async () => {
    const item = await seedItem(alice.id, aliceProject);
    await expect(storeItem({ ...item, name: 'other' })).rejects.toThrow();
    expect((await getItem(item.id, alice.id))?.name).toBe('Item');
  });
});

describe('updateItem', () => {
  it('updates every editable field and reports one changed row', async () => {
    const item = await seedItem(alice.id, aliceProject);

    const changed = await updateItem(
      item.id,
      {
        name: 'Renamed',
        description: 'Now described',
        completed: true,
        priority: 'urgent',
        dueDate: new Date('2026-12-24T18:00:00.000Z'),
        projectId: aliceProject,
      },
      alice.id
    );

    expect(changed).toBe(1);
    expect(await getItem(item.id, alice.id)).toEqual({
      ...item,
      name: 'Renamed',
      description: 'Now described',
      completed: true,
      priority: 'urgent',
      dueDate: new Date('2026-12-24T18:00:00.000Z'),
    });
  });

  it('can clear the description and due date', async () => {
    const item = await seedItem(alice.id, aliceProject, {
      description: 'to clear',
      dueDate: new Date('2026-12-24T18:00:00.000Z'),
    });

    await updateItem(item.id, { ...fields(item), description: null, dueDate: null }, alice.id);

    expect(await getItem(item.id, alice.id)).toMatchObject({ description: null, dueDate: null });
  });

  it('keeps the current project when projectId is not given', async () => {
    const item = await seedItem(alice.id, aliceProject);
    await updateItem(item.id, { ...fields(item), name: 'x' }, alice.id);

    expect((await getItem(item.id, alice.id))?.projectId).toBe(aliceProject);
  });

  it('moves the item to another project', async () => {
    const other = await seedProject(alice.id, 'Other');
    const item = await seedItem(alice.id, aliceProject);

    await updateItem(item.id, { ...fields(item), projectId: other }, alice.id);

    expect((await getItem(item.id, alice.id))?.projectId).toBe(other);
  });

  it('never changes the owner or the creation date', async () => {
    const item = await seedItem(alice.id, aliceProject);
    await updateItem(
      item.id,
      { ...fields(item), userId: bob.id, createdAt: new Date('2000-01-01T00:00:00.000Z') } as never,
      alice.id
    );

    const after = await getItem(item.id, alice.id);
    expect(after?.userId).toBe(alice.id);
    expect(after?.createdAt).toEqual(item.createdAt);
  });

  it('returns 0 and changes nothing for an unknown id', async () => {
    const item = await seedItem(alice.id, aliceProject);
    expect(await updateItem(crypto.randomUUID(), { ...fields(item), name: 'x' }, alice.id)).toBe(0);
    expect(await names(alice.id)).toEqual(['Item']);
  });

  it('only updates the selected item', async () => {
    const first = await seedItem(alice.id, aliceProject, { name: 'first' });
    const second = await seedItem(alice.id, aliceProject, { name: 'second' });

    await updateItem(first.id, { ...fields(first), completed: true }, alice.id);

    expect(await getItem(first.id, alice.id)).toMatchObject({ completed: true });
    expect(await getItem(second.id, alice.id)).toEqual(second);
  });

  it('does not let another user update the item', async () => {
    const item = await seedItem(alice.id, aliceProject);

    expect(await updateItem(item.id, { ...fields(item), name: 'pwned' }, bob.id)).toBe(0);
    expect(await getItem(item.id, alice.id)).toEqual(item);
  });
});

describe('removeItem', () => {
  it('removes the item', async () => {
    const item = await seedItem(alice.id, aliceProject);

    expect(await removeItem(item.id, alice.id)).toBe(1);
    expect(await getItems(alice.id)).toEqual([]);
  });

  it('only removes the selected item', async () => {
    const first = await seedItem(alice.id, aliceProject, { name: 'first' });
    const second = await seedItem(alice.id, aliceProject, { name: 'second' });

    await removeItem(first.id, alice.id);

    expect(await getItems(alice.id)).toEqual([second]);
  });

  it('returns 0 for an unknown id', async () => {
    expect(await removeItem(crypto.randomUUID(), alice.id)).toBe(0);
  });

  it('does not let another user remove the item', async () => {
    const item = await seedItem(alice.id, aliceProject);

    expect(await removeItem(item.id, bob.id)).toBe(0);
    expect(await getItem(item.id, alice.id)).toEqual(item);
  });
});

describe('user scoping', () => {
  it('never mixes the items of two users, with or without filters', async () => {
    const mine = await seedItem(alice.id, aliceProject, { name: 'mine', priority: 'high' });
    const theirs = await seedItem(bob.id, bobProject, { name: 'theirs', priority: 'high' });

    expect(await getItems(alice.id)).toEqual([mine]);
    expect(await getItems(bob.id)).toEqual([theirs]);
    expect(await names(alice.id, { priority: 'high', sortBy: 'name', sortOrder: 'asc' })).toEqual(['mine']);
    expect(await getItem(theirs.id, alice.id)).toBeUndefined();
  });
});

describe('priority filter', () => {
  it('returns only items with the requested priority', async () => {
    for (const priority of ['low', 'medium', 'high', 'urgent'] as const) {
      await seedItem(alice.id, aliceProject, { name: priority, priority });
    }

    expect(await names(alice.id, { priority: 'high' })).toEqual(['high']);
    expect(await names(alice.id, { priority: 'urgent' })).toEqual(['urgent']);
    expect(await names(alice.id, { priority: 'low' })).toEqual(['low']);
  });
});

describe('date filters', () => {
  // Wednesday 30 September 2026, noon local time. Only Date is faked so database drivers keep working.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));
  });

  const due = (name: string, dueDate: Date | null, overrides = {}) =>
    seedItem(alice.id, aliceProject, { name, dueDate, ...overrides });

  describe('today', () => {
    it('includes the whole local day and nothing outside it', async () => {
      await due('yesterday 23:59:59', new Date(2026, 8, 29, 23, 59, 59));
      await due('today 00:00:00', new Date(2026, 8, 30, 0, 0, 0));
      await due('today 23:59:59', new Date(2026, 8, 30, 23, 59, 59));
      await due('tomorrow 00:00:00', new Date(2026, 9, 1, 0, 0, 0));
      await due('no due date', null);

      expect((await names(alice.id, { filter: 'today' })).sort()).toEqual(['today 00:00:00', 'today 23:59:59']);
    });

    it('includes completed items due today', async () => {
      await due('done today', new Date(2026, 8, 30, 9, 0, 0), { completed: true });
      expect(await names(alice.id, { filter: 'today' })).toEqual(['done today']);
    });
  });

  describe('week (Monday to Sunday)', () => {
    it('spans Monday 00:00 up to the next Monday 00:00', async () => {
      await due('sunday before 23:59:59', new Date(2026, 8, 27, 23, 59, 59));
      await due('monday 00:00:00', new Date(2026, 8, 28, 0, 0, 0));
      await due('wednesday', new Date(2026, 8, 30, 12, 0, 0));
      await due('sunday 23:59:59', new Date(2026, 9, 4, 23, 59, 59));
      await due('next monday 00:00:00', new Date(2026, 9, 5, 0, 0, 0));
      await due('no due date', null);

      expect((await names(alice.id, { filter: 'week' })).sort()).toEqual([
        'monday 00:00:00',
        'sunday 23:59:59',
        'wednesday',
      ]);
    });

    it('treats Sunday as the last day of its week, not the first of the next', async () => {
      vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0));
      await due('monday', new Date(2026, 8, 28, 8, 0, 0));
      await due('next monday', new Date(2026, 9, 5, 8, 0, 0));

      expect(await names(alice.id, { filter: 'week' })).toEqual(['monday']);
    });

    it('starts a new week on Monday at midnight', async () => {
      vi.setSystemTime(new Date(2026, 9, 5, 0, 0, 0));
      await due('last sunday', new Date(2026, 9, 4, 23, 59, 59));
      await due('this monday', new Date(2026, 9, 5, 0, 0, 1));

      expect(await names(alice.id, { filter: 'week' })).toEqual(['this monday']);
    });
  });

  describe('overdue', () => {
    it('returns incomplete items whose due date has passed', async () => {
      await due('one second ago', new Date(2026, 8, 30, 11, 59, 59));
      await due('last year', new Date(2025, 0, 1, 0, 0, 0));
      await due('one second ahead', new Date(2026, 8, 30, 12, 0, 1));
      await due('done and late', new Date(2026, 8, 1, 0, 0, 0), { completed: true });
      await due('no due date', null);

      expect((await names(alice.id, { filter: 'overdue' })).sort()).toEqual(['last year', 'one second ago']);
    });
  });

  it('combines a date filter with a priority filter', async () => {
    await due('urgent today', new Date(2026, 8, 30, 9, 0, 0), { priority: 'urgent' });
    await due('low today', new Date(2026, 8, 30, 9, 0, 0), { priority: 'low' });
    await due('urgent later', new Date(2026, 9, 20, 9, 0, 0), { priority: 'urgent' });

    expect(await names(alice.id, { filter: 'today', priority: 'urgent' })).toEqual(['urgent today']);
  });

  it('applies the date filter to the requesting user only', async () => {
    await due('mine', new Date(2026, 8, 30, 9, 0, 0));
    await seedItem(bob.id, bobProject, { name: 'theirs', dueDate: new Date(2026, 8, 30, 9, 0, 0) });

    expect(await names(alice.id, { filter: 'today' })).toEqual(['mine']);
  });
});

describe('sorting', () => {
  it('sorts by priority, highest first by default and lowest first with asc', async () => {
    for (const priority of ['medium', 'urgent', 'low', 'high'] as const) {
      await seedItem(alice.id, aliceProject, { name: priority, priority });
    }

    expect(await names(alice.id, { sortBy: 'priority' })).toEqual(['urgent', 'high', 'medium', 'low']);
    expect(await names(alice.id, { sortBy: 'priority', sortOrder: 'desc' })).toEqual([
      'urgent',
      'high',
      'medium',
      'low',
    ]);
    expect(await names(alice.id, { sortBy: 'priority', sortOrder: 'asc' })).toEqual([
      'low',
      'medium',
      'high',
      'urgent',
    ]);
  });

  it('sorts by name ascending by default and descending on request', async () => {
    for (const name of ['banana', 'cherry', 'apple']) await seedItem(alice.id, aliceProject, { name });

    expect(await names(alice.id, { sortBy: 'name' })).toEqual(['apple', 'banana', 'cherry']);
    expect(await names(alice.id, { sortBy: 'name', sortOrder: 'asc' })).toEqual(['apple', 'banana', 'cherry']);
    expect(await names(alice.id, { sortBy: 'name', sortOrder: 'desc' })).toEqual(['cherry', 'banana', 'apple']);
  });

  it('sorts by due date and always puts items without a due date last', async () => {
    await seedItem(alice.id, aliceProject, { name: 'none' });
    await seedItem(alice.id, aliceProject, { name: 'later', dueDate: new Date('2026-12-01T00:00:00.000Z') });
    await seedItem(alice.id, aliceProject, { name: 'sooner', dueDate: new Date('2026-11-01T00:00:00.000Z') });

    expect(await names(alice.id, { sortBy: 'dueDate' })).toEqual(['sooner', 'later', 'none']);
    expect(await names(alice.id, { sortBy: 'dueDate', sortOrder: 'asc' })).toEqual(['sooner', 'later', 'none']);
    expect(await names(alice.id, { sortBy: 'dueDate', sortOrder: 'desc' })).toEqual(['later', 'sooner', 'none']);
  });

  it('sorts within a filter', async () => {
    await seedItem(alice.id, aliceProject, { name: 'b', priority: 'high' });
    await seedItem(alice.id, aliceProject, { name: 'a', priority: 'high' });
    await seedItem(alice.id, aliceProject, { name: 'c', priority: 'low' });

    expect(await names(alice.id, { priority: 'high', sortBy: 'name' })).toEqual(['a', 'b']);
  });
});

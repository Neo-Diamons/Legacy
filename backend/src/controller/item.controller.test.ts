import { ItemListResponseSchema, ItemResponseSchema } from '@schemas/item.schemas.js';
import { itemService } from '@service/item.service.js';
import { resetDb } from '../test/db.js';
import { call, json, seedItem, seedProject, seedUser } from '../test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
let alice: Session;
let bob: Session;
let project: string;
let bobProject: string;

// Placeholder swapped for the real project id at run time (the id does not exist when the tables are built).
const PROJECT = '__project__';
const FOREIGN_ID = '99999999-9999-4999-8999-999999999999';

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
  bob = await seedUser('bob@example.com');
  project = await seedProject(alice.id);
  bobProject = await seedProject(bob.id);
});

afterEach(() => {
  vi.useRealTimers();
});

const list = async (query = '', session = alice) => json(await call(session, 'GET', `/items${query}`));
const listNames = async (query = '', session = alice) =>
  (await list(query, session)).map((i: { name: string }) => i.name);
const create = (body: Record<string, unknown>, session = alice) => call(session, 'POST', '/items', body);
const update = (id: string, body: Record<string, unknown>, session = alice) =>
  call(session, 'PUT', `/items/${id}`, body);
const remove = (id: string, session = alice) => call(session, 'DELETE', `/items/${id}`);

describe('authentication', () => {
  const id = crypto.randomUUID();
  it.each([
    ['GET', '/items', undefined],
    ['POST', '/items', { name: 'x', projectId: FOREIGN_ID }],
    ['PUT', `/items/${id}`, { name: 'x', completed: false }],
    ['DELETE', `/items/${id}`, undefined],
  ])('%s %s answers 401 without a token', async (method, path, body) => {
    expect((await call(null, method, path, body)).status).toBe(401);
  });
});

describe('GET /items', () => {
  it('is empty for a new user', async () => {
    const res = await call(alice, 'GET', '/items');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual([]);
  });

  it('returns the items of the caller in the documented shape', async () => {
    const item = await seedItem(alice.id, project, {
      name: 'Buy milk',
      description: 'Oat',
      priority: 'high',
      dueDate: new Date('2099-01-01T10:00:00.000Z'),
    });

    const body = await list();

    expect(() => ItemListResponseSchema.parse(body)).not.toThrow();
    expect(body).toEqual([
      {
        id: item.id,
        name: 'Buy milk',
        description: 'Oat',
        completed: false,
        priority: 'high',
        dueDate: '2099-01-01T10:00:00.000Z',
        projectId: project,
        overdue: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('never exposes the owner id and never returns items of other users', async () => {
    await seedItem(bob.id, bobProject, { name: 'Bobs secret' });
    await seedItem(alice.id, project, { name: 'Mine' });

    const text = await (await call(alice, 'GET', '/items')).text();

    expect(JSON.parse(text).map((i: { name: string }) => i.name)).toEqual(['Mine']);
    expect(text).not.toContain('Bobs secret');
    expect(text).not.toContain(alice.id);
    expect(text).not.toContain(bob.id);
  });

  describe('overdue flag', () => {
    it('is set for an incomplete item whose due date has passed', async () => {
      await seedItem(alice.id, project, { name: 'late', dueDate: new Date('2020-01-01T00:00:00.000Z') });
      expect((await list())[0].overdue).toBe(true);
    });

    it.each([
      ['a completed item', { completed: true, dueDate: new Date('2020-01-01T00:00:00.000Z') }],
      ['an item due in the future', { dueDate: new Date('2099-01-01T00:00:00.000Z') }],
      ['an item without a due date', { dueDate: null }],
    ])('is not set for %s', async (_label, overrides) => {
      await seedItem(alice.id, project, overrides);
      expect((await list())[0].overdue).toBe(false);
    });
  });

  describe('query parameters', () => {
    // Wednesday 15 May 2024, noon local time. Only Date is faked.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2024, 4, 15, 12, 0, 0));
    });

    const seedDue = (name: string, dueDate: Date | null, overrides = {}) =>
      seedItem(alice.id, project, { name, dueDate, ...overrides });

    it('filter=today keeps only what is due today', async () => {
      await seedDue('yesterday', new Date(2024, 4, 14, 23, 59, 59));
      await seedDue('today', new Date(2024, 4, 15, 8, 0, 0));
      await seedDue('tomorrow', new Date(2024, 4, 16, 0, 0, 0));
      await seedDue('never', null);

      expect(await listNames('?filter=today')).toEqual(['today']);
    });

    it('filter=week keeps Monday to Sunday of the current week', async () => {
      await seedDue('last sunday', new Date(2024, 4, 12, 23, 59, 59));
      await seedDue('monday', new Date(2024, 4, 13, 0, 0, 0));
      await seedDue('sunday', new Date(2024, 4, 19, 23, 59, 59));
      await seedDue('next monday', new Date(2024, 4, 20, 0, 0, 0));

      expect((await listNames('?filter=week')).sort()).toEqual(['monday', 'sunday']);
    });

    it('filter=overdue keeps incomplete items past their due date', async () => {
      await seedDue('late', new Date(2024, 4, 15, 11, 0, 0));
      await seedDue('late but done', new Date(2024, 4, 15, 11, 0, 0), { completed: true });
      await seedDue('upcoming', new Date(2024, 4, 15, 13, 0, 0));

      expect(await listNames('?filter=overdue')).toEqual(['late']);
    });

    it('priority=<level> keeps only that priority', async () => {
      await seedDue('a', null, { priority: 'low' });
      await seedDue('b', null, { priority: 'urgent' });

      expect(await listNames('?priority=urgent')).toEqual(['b']);
    });

    it('combines filter and priority', async () => {
      const today = new Date(2024, 4, 15, 8, 0, 0);
      await seedDue('urgent today', today, { priority: 'urgent' });
      await seedDue('low today', today, { priority: 'low' });
      await seedDue('urgent later', new Date(2024, 5, 20, 8, 0, 0), { priority: 'urgent' });

      expect(await listNames('?filter=today&priority=urgent')).toEqual(['urgent today']);
    });

    it('sortBy=priority orders by urgency (highest first unless sortOrder=asc)', async () => {
      for (const priority of ['medium', 'urgent', 'low', 'high']) await seedDue(priority, null, { priority });

      expect(await listNames('?sortBy=priority')).toEqual(['urgent', 'high', 'medium', 'low']);
      expect(await listNames('?sortBy=priority&sortOrder=asc')).toEqual(['low', 'medium', 'high', 'urgent']);
    });

    it('sortBy=name orders alphabetically', async () => {
      for (const name of ['banana', 'cherry', 'apple']) await seedDue(name, null);

      expect(await listNames('?sortBy=name&sortOrder=asc')).toEqual(['apple', 'banana', 'cherry']);
      expect(await listNames('?sortBy=name&sortOrder=desc')).toEqual(['cherry', 'banana', 'apple']);
    });

    it('sortBy=dueDate orders by date with undated items last', async () => {
      await seedDue('none', null);
      await seedDue('later', new Date(2024, 8, 1, 0, 0, 0));
      await seedDue('sooner', new Date(2024, 6, 1, 0, 0, 0));

      expect(await listNames('?sortBy=dueDate&sortOrder=asc')).toEqual(['sooner', 'later', 'none']);
      expect(await listNames('?sortBy=dueDate&sortOrder=desc')).toEqual(['later', 'sooner', 'none']);
    });

    it('applies filters only to the items of the caller', async () => {
      await seedDue('mine', new Date(2024, 4, 15, 8, 0, 0));
      await seedItem(bob.id, bobProject, { name: 'theirs', dueDate: new Date(2024, 4, 15, 8, 0, 0) });

      expect(await listNames('?filter=today')).toEqual(['mine']);
    });

    it.each([
      ['an unknown parameter', '?bogus=1'],
      ['an unknown filter', '?filter=yesterday'],
      ['an unknown priority', '?priority=critical'],
      ['an unknown sort key', '?sortBy=id'],
      ['an unknown sort order', '?sortOrder=sideways'],
    ])('answers 422 for %s', async (_label, query) => {
      const res = await call(alice, 'GET', `/items${query}`);
      expect(res.status).toBe(422);
      expect((await json(res)).message).toBe('Validation failed');
    });
  });
});

describe('POST /items', () => {
  it('creates an item with sensible defaults and answers 201', async () => {
    const res = await create({ name: 'Buy milk', projectId: project });
    const body = await json(res);

    expect(res.status).toBe(201);
    expect(() => ItemResponseSchema.parse(body)).not.toThrow();
    expect(body).toEqual({
      id: expect.any(String),
      name: 'Buy milk',
      description: null,
      completed: false,
      priority: 'medium',
      dueDate: null,
      projectId: project,
      overdue: false,
      createdAt: expect.any(String),
    });
    expect(Math.abs(Date.now() - new Date(body.createdAt).getTime())).toBeLessThan(5000);
  });

  it('persists the item for its owner, and only them', async () => {
    const { id } = await json(await create({ name: 'Buy milk', projectId: project }));

    expect(await itemService.getItem(id, alice.id)).toMatchObject({
      name: 'Buy milk',
      userId: alice.id,
      projectId: project,
    });
    expect(await list()).toHaveLength(1);
    expect(await list('', bob)).toEqual([]);
  });

  it('stores every optional field it is given', async () => {
    const res = await create({
      name: 'Report',
      description: 'Quarterly',
      priority: 'urgent',
      dueDate: '2099-03-04T05:06:07.000Z',
      projectId: project,
    });

    expect(await json(res)).toMatchObject({
      description: 'Quarterly',
      priority: 'urgent',
      dueDate: '2099-03-04T05:06:07.000Z',
      overdue: false,
    });
    expect((await list())[0]).toMatchObject({ description: 'Quarterly', priority: 'urgent' });
  });

  it('flags an item created with a past due date as overdue', async () => {
    const res = await create({ name: 'Late', dueDate: '2020-01-01T00:00:00.000Z', projectId: project });
    expect((await json(res)).overdue).toBe(true);
  });

  it.each([
    ['a null description', { description: null }],
    ['a null due date', { dueDate: null }],
    ['an empty name', { name: '' }],
    ['a very long name', { name: 'A'.repeat(10_000) }],
    ['a very long description', { description: 'D'.repeat(10_000) }],
    ['special characters', { name: `<script>alert("x")</script> ' " \\ é日本語🚀` }],
    ['spaces in the name', { name: '  spaced  out  ' }],
  ])('accepts %s and returns it unchanged', async (_label, overrides) => {
    const res = await create({ name: 'x', projectId: project, ...overrides });
    const body = await json(res);

    expect(res.status).toBe(201);
    for (const [key, value] of Object.entries(overrides)) expect(body[key]).toBe(value);
    expect((await list())[0].name).toBe('name' in overrides ? overrides.name : 'x');
  });

  it('gives every item its own id', async () => {
    const a = await json(await create({ name: 'same', projectId: project }));
    const b = await json(await create({ name: 'same', projectId: project }));
    expect(a.id).not.toBe(b.id);
  });

  it.each([
    ['a missing name', { projectId: PROJECT }],
    ['a missing project', { name: 'x' }],
    ['a project id that is not a uuid', { name: 'x', projectId: 'nope' }],
    ['an unknown priority', { name: 'x', projectId: PROJECT, priority: 'critical' }],
    ['a due date that is not ISO 8601', { name: 'x', projectId: PROJECT, dueDate: 'tomorrow' }],
    ['a due date without a time', { name: 'x', projectId: PROJECT, dueDate: '2099-01-01' }],
    ['a non-string name', { name: 12, projectId: PROJECT }],
    ['a name over 10000 characters', { name: 'A'.repeat(10_001), projectId: PROJECT }],
    ['a description over 10000 characters', { name: 'x', description: 'D'.repeat(10_001), projectId: PROJECT }],
    ['a forged id', { name: 'x', projectId: PROJECT, id: FOREIGN_ID }],
    ['a forged owner', { name: 'x', projectId: PROJECT, userId: FOREIGN_ID }],
    ['completed', { name: 'x', projectId: PROJECT, completed: true }],
    ['a forged creation date', { name: 'x', projectId: PROJECT, createdAt: '2000-01-01T00:00:00.000Z' }],
  ])('answers 422 for %s and stores nothing', async (_label, body) => {
    const res = await create(JSON.parse(JSON.stringify(body).replace(PROJECT, project)));

    expect(res.status).toBe(422);
    expect((await json(res)).message).toBe('Validation failed');
    expect(await itemService.getItems(alice.id)).toEqual([]);
  });

  it('answers 404 for a project that does not exist', async () => {
    const res = await create({ name: 'x', projectId: crypto.randomUUID() });

    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Project not found' });
    expect(await itemService.getItems(alice.id)).toEqual([]);
  });

  it('answers 404 for a project of another user, and stores nothing anywhere', async () => {
    const res = await create({ name: 'x', projectId: bobProject });

    expect(res.status).toBe(404);
    expect(await itemService.getItems(alice.id)).toEqual([]);
    expect(await itemService.getItems(bob.id)).toEqual([]);
  });
});

describe('PUT /items/:id', () => {
  it('replaces the editable fields and returns the stored item', async () => {
    const item = await seedItem(alice.id, project, { name: 'Old', description: 'old', priority: 'low' });

    const res = await update(item.id, {
      name: 'New',
      completed: true,
      description: 'new',
      priority: 'urgent',
      dueDate: '2099-05-06T07:08:09.000Z',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(() => ItemResponseSchema.parse(body)).not.toThrow();
    expect(body).toEqual({
      id: item.id,
      name: 'New',
      completed: true,
      description: 'new',
      priority: 'urgent',
      dueDate: '2099-05-06T07:08:09.000Z',
      projectId: project,
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await list()).toEqual([body]);
  });

  it('marks an item as completed', async () => {
    const item = await seedItem(alice.id, project, { name: 'Todo' });
    expect((await json(await update(item.id, { name: 'Todo', completed: true }))).completed).toBe(true);
  });

  it('clears the due date and description when they are sent as null', async () => {
    const item = await seedItem(alice.id, project, {
      description: 'to clear',
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
    });

    const body = await json(await update(item.id, { name: 'x', completed: false, description: null, dueDate: null }));

    expect(body).toMatchObject({ description: null, dueDate: null });
  });

  it('treats the body as a full replacement: omitted optional fields are reset', async () => {
    const item = await seedItem(alice.id, project, {
      description: 'will be dropped',
      priority: 'urgent',
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
    });

    const body = await json(await update(item.id, { name: 'x', completed: false }));

    expect(body).toMatchObject({ description: null, priority: 'medium', dueDate: null });
  });

  it('keeps the project when projectId is omitted', async () => {
    const item = await seedItem(alice.id, project);
    expect((await json(await update(item.id, { name: 'x', completed: false }))).projectId).toBe(project);
  });

  it('moves the item to another project of the caller', async () => {
    const other = await seedProject(alice.id, 'Other');
    const item = await seedItem(alice.id, project);

    const res = await update(item.id, { name: 'x', completed: false, projectId: other });

    expect((await json(res)).projectId).toBe(other);
    expect((await itemService.getItem(item.id, alice.id))?.projectId).toBe(other);
  });

  it('answers 404 when moving to a project of another user, leaving the item where it was', async () => {
    const item = await seedItem(alice.id, project, { name: 'stay' });

    const res = await update(item.id, { name: 'moved', completed: true, projectId: bobProject });

    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Project not found' });
    expect(await itemService.getItem(item.id, alice.id)).toEqual(item);
  });

  it('answers 404 when moving to a project that does not exist', async () => {
    const item = await seedItem(alice.id, project);
    expect((await update(item.id, { name: 'x', completed: false, projectId: crypto.randomUUID() })).status).toBe(404);
    expect((await itemService.getItem(item.id, alice.id))?.projectId).toBe(project);
  });

  it('recomputes the overdue flag when the item is completed', async () => {
    const item = await seedItem(alice.id, project, { dueDate: new Date('2020-01-01T00:00:00.000Z') });
    expect((await list())[0].overdue).toBe(true);

    const body = await json(await update(item.id, { name: 'x', completed: true, dueDate: '2020-01-01T00:00:00.000Z' }));

    expect(body.overdue).toBe(false);
  });

  it('answers 404 for an unknown item', async () => {
    const res = await update(crypto.randomUUID(), { name: 'x', completed: false });
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Item not found' });
  });

  it('answers 404 for an item of another user and leaves it untouched', async () => {
    const item = await seedItem(bob.id, bobProject, { name: 'Bobs' });

    expect((await update(item.id, { name: 'Hacked', completed: true })).status).toBe(404);
    expect(await itemService.getItem(item.id, bob.id)).toEqual(item);
  });

  it.each([
    ['a missing name', { completed: false }],
    ['a missing completed flag', { name: 'x' }],
    ['a non-boolean completed flag', { name: 'x', completed: 'yes' }],
    ['a name over 10000 characters', { name: 'A'.repeat(10_001), completed: false }],
    ['a description over 10000 characters', { name: 'x', completed: false, description: 'D'.repeat(10_001) }],
    ['an unknown priority', { name: 'x', completed: false, priority: 'critical' }],
    ['a malformed due date', { name: 'x', completed: false, dueDate: 'soon' }],
    ['a project id that is not a uuid', { name: 'x', completed: false, projectId: 'nope' }],
    ['a forged owner', { name: 'x', completed: false, userId: FOREIGN_ID }],
    ['a forged id', { name: 'x', completed: false, id: FOREIGN_ID }],
  ])('answers 422 for %s and changes nothing', async (_label, body) => {
    const item = await seedItem(alice.id, project);

    expect((await update(item.id, body)).status).toBe(422);
    expect(await itemService.getItem(item.id, alice.id)).toEqual(item);
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await update('abc-123', { name: 'x', completed: false })).status).toBe(422);
  });
});

describe('DELETE /items/:id', () => {
  it('answers 204 with an empty body and removes the item', async () => {
    const item = await seedItem(alice.id, project);

    const res = await remove(item.id);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await list()).toEqual([]);
  });

  it('removes only the requested item', async () => {
    const first = await seedItem(alice.id, project, { name: 'first' });
    const second = await seedItem(alice.id, project, { name: 'second' });

    await remove(first.id);

    expect(await listNames()).toEqual(['second']);
    expect(await itemService.getItem(second.id, alice.id)).toEqual(second);
  });

  it('answers 404 the second time', async () => {
    const item = await seedItem(alice.id, project);
    await remove(item.id);

    const res = await remove(item.id);
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Item not found' });
  });

  it('answers 404 for an unknown item', async () => {
    expect((await remove(crypto.randomUUID())).status).toBe(404);
  });

  it('answers 404 for an item of another user and keeps it', async () => {
    const item = await seedItem(bob.id, bobProject);

    expect((await remove(item.id)).status).toBe(404);
    expect(await itemService.getItem(item.id, bob.id)).toEqual(item);
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await remove('a'.repeat(500))).status).toBe(422);
  });
});

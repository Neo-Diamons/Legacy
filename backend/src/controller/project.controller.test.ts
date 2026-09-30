import { ProjectResponseSchema } from '@schemas/project.schemas.js';
import { itemService } from '@service/item.service.js';
import { projectService } from '@service/project.service.js';
import { resetDb } from '../test/db.js';
import { call, json, seedItem, seedProject, seedUser } from '../test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
const FOREIGN_ID = '99999999-9999-4999-8999-999999999999';
let alice: Session;
let bob: Session;

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
  bob = await seedUser('bob@example.com');
});

describe('authentication', () => {
  const id = crypto.randomUUID();
  it.each([
    ['GET', '/projects', undefined],
    ['POST', '/projects', { name: 'x', color: '#000' }],
    ['PUT', `/projects/${id}`, { name: 'x', color: '#000' }],
    ['DELETE', `/projects/${id}`, undefined],
  ])('%s %s answers 401 without a token', async (method, path, body) => {
    expect((await call(null, method, path, body)).status).toBe(401);
  });
});

describe('GET /projects', () => {
  it('is empty for a new user', async () => {
    const res = await call(alice, 'GET', '/projects');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual([]);
  });

  it('lists the projects of the caller, conforming to the response schema', async () => {
    const id = await seedProject(alice.id, 'Work', '#ff0000');
    const body = await json(await call(alice, 'GET', '/projects'));

    expect(() => ProjectResponseSchema.array().parse(body)).not.toThrow();
    expect(body).toEqual([{ id, name: 'Work', color: '#ff0000', createdAt: expect.any(String) }]);
  });

  it('never lists the projects of another user, and never exposes the owner id', async () => {
    await seedProject(bob.id, 'Bobs');
    const mine = await seedProject(alice.id, 'Mine');

    const text = await (await call(alice, 'GET', '/projects')).text();

    expect(JSON.parse(text).map((p: { id: string }) => p.id)).toEqual([mine]);
    expect(text).not.toContain('Bobs');
    expect(text).not.toContain(alice.id);
  });
});

describe('POST /projects', () => {
  const create = (body: unknown, session = alice) => call(session, 'POST', '/projects', body);

  it('creates a project owned by the caller and answers 201', async () => {
    const res = await create({ name: 'Work', color: '#00ff00' });
    const body = await json(res);

    expect(res.status).toBe(201);
    expect(() => ProjectResponseSchema.parse(body)).not.toThrow();
    expect(body).toMatchObject({ name: 'Work', color: '#00ff00' });
    expect(Math.abs(Date.now() - new Date(body.createdAt).getTime())).toBeLessThan(5000);
    expect(await projectService.getProject(body.id, alice.id)).toMatchObject({ name: 'Work', userId: alice.id });
  });

  it('is visible to the creator only', async () => {
    const { id } = await json(await create({ name: 'Work', color: '#00ff00' }));

    expect((await json(await call(alice, 'GET', '/projects'))).map((p: { id: string }) => p.id)).toEqual([id]);
    expect(await json(await call(bob, 'GET', '/projects'))).toEqual([]);
  });

  it('generates a distinct server-side id each time', async () => {
    const a = await json(await create({ name: 'A', color: '#111111' }));
    const b = await json(await create({ name: 'A', color: '#111111' }));
    expect(a.id).not.toBe(b.id);
  });

  it('accepts a 32 character colour, a 255 character name and unicode names', async () => {
    expect((await create({ name: 'Projet été 日本 🚀', color: 'c'.repeat(32) })).status).toBe(201);
    expect((await create({ name: 'n'.repeat(255), color: '#000000' })).status).toBe(201);
  });

  it.each([
    ['a missing name', { color: '#000000' }],
    ['a missing colour', { name: 'x' }],
    ['an empty name', { name: '', color: '#000000' }],
    ['a name longer than 255 characters', { name: 'n'.repeat(256), color: '#000000' }],
    ['an empty colour', { name: 'x', color: '' }],
    ['a 33 character colour', { name: 'x', color: 'c'.repeat(33) }],
    ['a non-string name', { name: 42, color: '#000000' }],
    ['a forged id', { name: 'x', color: '#000000', id: crypto.randomUUID() }],
    ['a forged owner', { name: 'x', color: '#000000', userId: FOREIGN_ID }],
  ])('answers 422 for %s and creates nothing', async (_label, body) => {
    expect((await create(body)).status).toBe(422);
    expect(await projectService.getProjects(alice.id)).toEqual([]);
    expect(await projectService.getProjects(bob.id)).toEqual([]);
  });
});

describe('PUT /projects/:id', () => {
  const put = (id: string, body: unknown, session = alice) => call(session, 'PUT', `/projects/${id}`, body);

  it('updates name and colour and returns the updated project', async () => {
    const id = await seedProject(alice.id, 'Old', '#111111');
    const res = await put(id, { name: 'New', color: '#222222' });

    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id, name: 'New', color: '#222222' });
    expect(await projectService.getProject(id, alice.id)).toMatchObject({ name: 'New', color: '#222222' });
  });

  it('keeps the creation date and the items of the project', async () => {
    const id = await seedProject(alice.id);
    const item = await seedItem(alice.id, id);
    const before = (await projectService.getProject(id, alice.id))!.createdAt;

    await put(id, { name: 'New', color: '#222222' });

    expect((await projectService.getProject(id, alice.id))!.createdAt).toEqual(before);
    expect(await itemService.getItem(item.id, alice.id)).toEqual(item);
  });

  it('answers 404 for an unknown project', async () => {
    const res = await put(crypto.randomUUID(), { name: 'x', color: '#000000' });
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Project not found' });
  });

  it('answers 404 for a project of another user and leaves it untouched', async () => {
    const id = await seedProject(bob.id, 'Bobs', '#333333');

    expect((await put(id, { name: 'Hacked', color: '#000000' })).status).toBe(404);
    expect(await projectService.getProject(id, bob.id)).toMatchObject({ name: 'Bobs', color: '#333333' });
  });

  it.each([
    ['a missing colour', { name: 'x' }],
    ['a missing name', { color: '#000000' }],
    ['an empty name', { name: '', color: '#000000' }],
    ['a name longer than 255 characters', { name: 'n'.repeat(256), color: '#000000' }],
    ['a forged owner', { name: 'x', color: '#000000', userId: FOREIGN_ID }],
  ])('answers 422 for %s and changes nothing', async (_label, body) => {
    const id = await seedProject(alice.id, 'Keep', '#444444');

    expect((await put(id, body)).status).toBe(422);
    expect(await projectService.getProject(id, alice.id)).toMatchObject({ name: 'Keep', color: '#444444' });
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await put('nope', { name: 'x', color: '#000000' })).status).toBe(422);
  });
});

describe('DELETE /projects/:id', () => {
  it('answers 204 and deletes the project together with its items', async () => {
    const id = await seedProject(alice.id);
    const item = await seedItem(alice.id, id);

    const res = await call(alice, 'DELETE', `/projects/${id}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await projectService.getProject(id, alice.id)).toBeUndefined();
    expect(await itemService.getItem(item.id, alice.id)).toBeUndefined();
    expect(await json(await call(alice, 'GET', '/items'))).toEqual([]);
  });

  it('keeps the other projects and items of the user', async () => {
    const doomed = await seedProject(alice.id, 'Doomed');
    const kept = await seedProject(alice.id, 'Kept');
    await seedItem(alice.id, doomed);
    const survivor = await seedItem(alice.id, kept);

    await call(alice, 'DELETE', `/projects/${doomed}`);

    expect((await json(await call(alice, 'GET', '/projects'))).map((p: { id: string }) => p.id)).toEqual([kept]);
    expect(await itemService.getItems(alice.id)).toEqual([survivor]);
  });

  it('answers 404 the second time', async () => {
    const id = await seedProject(alice.id);
    await call(alice, 'DELETE', `/projects/${id}`);

    const res = await call(alice, 'DELETE', `/projects/${id}`);
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ message: 'Project not found' });
  });

  it('answers 404 for a project of another user and deletes nothing of theirs', async () => {
    const id = await seedProject(bob.id);
    const item = await seedItem(bob.id, id);

    expect((await call(alice, 'DELETE', `/projects/${id}`)).status).toBe(404);
    expect(await projectService.getProject(id, bob.id)).toBeDefined();
    expect(await itemService.getItem(item.id, bob.id)).toEqual(item);
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await call(alice, 'DELETE', '/projects/nope')).status).toBe(422);
  });
});

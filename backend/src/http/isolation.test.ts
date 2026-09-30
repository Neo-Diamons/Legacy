import { resetDb } from '../test/db.js';
import { call, json, seedItem, seedProject, seedUser } from '../test/fixtures.js';

/**
 * Cross-user matrix: every route that takes an id is hit by a user who does not own it.
 * The owner's data must come out untouched, and the answer must not reveal that the id exists.
 */
type Session = Awaited<ReturnType<typeof seedUser>>;
let alice: Session;
let mallory: Session;
let projectId: string;
let itemId: string;

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
  mallory = await seedUser('mallory@example.com');
  projectId = await seedProject(alice.id, 'Alice project', '#111111');
  itemId = (await seedItem(alice.id, projectId, { name: 'Alice item' })).id;
});

const snapshot = async () => ({
  user: await json(await call(alice, 'GET', `/users/${alice.id}`)),
  projects: await json(await call(alice, 'GET', '/projects')),
  items: await json(await call(alice, 'GET', '/items')),
});

describe('a user acting on the resources of another user', () => {
  const attacks = (): [string, string, string, unknown, number][] => [
    ['read the profile', 'GET', `/users/${alice.id}`, undefined, 403],
    ['rename the profile', 'PUT', `/users/${alice.id}`, { name: 'pwned' }, 403],
    [
      'take over the account',
      'PUT',
      `/users/${alice.id}`,
      { email: 'mallory2@example.com', password: 'attacker-password-1' },
      403,
    ],
    ['export the data', 'GET', `/users/${alice.id}/export`, undefined, 403],
    ['delete the account', 'DELETE', `/users/${alice.id}`, undefined, 403],
    ['update a project', 'PUT', `/projects/${projectId}`, { name: 'pwned', color: '#000000' }, 404],
    ['delete a project', 'DELETE', `/projects/${projectId}`, undefined, 404],
    ['update an item', 'PUT', `/items/${itemId}`, { name: 'pwned', completed: true }, 404],
    ['delete an item', 'DELETE', `/items/${itemId}`, undefined, 404],
    ['add an item to a project', 'POST', '/items', { name: 'pwned', projectId }, 404],
  ];

  it.each([
    'read the profile',
    'rename the profile',
    'take over the account',
    'export the data',
    'delete the account',
    'update a project',
    'delete a project',
    'update an item',
    'delete an item',
    'add an item to a project',
  ])('cannot %s', async (label) => {
    const [, method, path, body, expected] = attacks().find(([name]) => name === label)!;
    const before = await snapshot();

    const res = await call(mallory, method, path, body);

    expect(res.status).toBe(expected);
    expect(await snapshot()).toEqual(before);
  });

  it('cannot move an item of their own into the project of someone else', async () => {
    const own = await seedProject(mallory.id);
    const mine = await seedItem(mallory.id, own, { name: 'mine' });

    const res = await call(mallory, 'PUT', `/items/${mine.id}`, { name: 'mine', completed: false, projectId });

    expect(res.status).toBe(404);
    expect((await json(await call(mallory, 'GET', '/items')))[0].projectId).toBe(own);
    expect((await snapshot()).items).toHaveLength(1);
  });

  it('gets the same answer for a foreign id as for an id that never existed', async () => {
    const foreign = await call(mallory, 'DELETE', `/items/${itemId}`);
    const missing = await call(mallory, 'DELETE', `/items/${crypto.randomUUID()}`);

    expect(foreign.status).toBe(missing.status);
    expect(await foreign.text()).toBe(await missing.text());
  });

  it('sees empty lists and no trace of the other user', async () => {
    for (const path of ['/items', '/projects']) {
      expect(await json(await call(mallory, 'GET', path))).toEqual([]);
    }
    const profile = await json(await call(mallory, 'GET', '/users'));
    expect(profile.map((u: { id: string }) => u.id)).toEqual([mallory.id]);
  });
});

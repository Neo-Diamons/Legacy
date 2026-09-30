import { existsSync, unlinkSync } from 'fs';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.SQLITE_DB_LOCATION = './todo.isolation.test.db';

const { createRouter, registerErrorHandler } = await import('@http/app.js');
const { jwtAuth } = await import('@http/auth.js');
const { sqliteLocation } = await import('@db/config.js');
const { init, teardown } = await import('@db/db.sqlite.js');
const { authController, userController } = await import('@controller/user.controller.js');
const { itemController } = await import('@controller/item.controller.js');
const { projectController } = await import('@controller/project.controller.js');

const app = createRouter();
app.use('/items/*', jwtAuth());
app.use('/items', jwtAuth());
app.route('/items', itemController);
app.route('/auth', authController);
app.route('/users', userController);
app.use('/projects/*', jwtAuth());
app.use('/projects', jwtAuth());
app.route('/projects', projectController);
registerErrorHandler(app);

type Session = { id: string; headers: Record<string, string> };

async function register(email: string): Promise<Session> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name: email, password: 'correct-horse-battery' }),
  });
  expect(res.status).toBe(201);
  const { token, user } = await res.json();
  return { id: user.id, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

const call = (s: Session | null, method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: s?.headers ?? { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let alice: Session;
let bob: Session;
let projectId: string;
let itemId: string;

beforeEach(async () => {
  if (existsSync(sqliteLocation)) unlinkSync(sqliteLocation);
  await init();
  alice = await register('alice@example.com');
  bob = await register('bob@example.com');
  const project = await call(alice, 'POST', '/projects', { name: 'Alice project', color: '#ff0000' });
  expect(project.status).toBe(201);
  projectId = (await project.json()).id;
  const item = await call(alice, 'POST', '/items', { name: 'Alice item', projectId });
  expect(item.status).toBe(201);
  itemId = (await item.json()).id;
});

afterEach(async () => {
  await teardown();
});

describe('unauthenticated requests', () => {
  test.each([
    ['GET', '/items'],
    ['GET', '/projects'],
    ['GET', '/users'],
  ])('%s %s is rejected', async (method, path) => {
    expect((await call(null, method, path)).status).toBe(401);
  });

  test('a malformed token is rejected', async () => {
    const res = await app.request('/items', { headers: { Authorization: 'Bearer nope' } });
    expect(res.status).toBe(401);
  });
});

describe('users', () => {
  test('GET /users returns only the caller', async () => {
    const body = await (await call(bob, 'GET', '/users')).json();
    expect(body.map((u: { id: string }) => u.id)).toEqual([bob.id]);
  });

  test.each([
    ['GET', ''],
    ['PUT', ''],
    ['DELETE', ''],
    ['GET', '/export'],
  ])('%s /users/:id%s of another user is forbidden', async (method, suffix) => {
    const res = await call(
      bob,
      method,
      `/users/${alice.id}${suffix}`,
      method === 'PUT' ? { name: 'pwned' } : undefined
    );
    expect(res.status).toBe(403);
    const still = await (await call(alice, 'GET', `/users/${alice.id}`)).json();
    expect(still.name).toBe('alice@example.com');
  });
});

describe('items and projects', () => {
  test('lists never include another user data', async () => {
    expect(await (await call(bob, 'GET', '/items')).json()).toEqual([]);
    expect(await (await call(bob, 'GET', '/projects')).json()).toEqual([]);
    expect(await (await call(alice, 'GET', '/items')).json()).toHaveLength(1);
  });

  test('another user cannot update or delete an item', async () => {
    expect((await call(bob, 'PUT', `/items/${itemId}`, { name: 'pwned', completed: true })).status).toBe(404);
    expect((await call(bob, 'DELETE', `/items/${itemId}`)).status).toBe(404);
    const items = await (await call(alice, 'GET', '/items')).json();
    expect(items[0].name).toBe('Alice item');
  });

  test('another user cannot update or delete a project', async () => {
    expect((await call(bob, 'PUT', `/projects/${projectId}`, { name: 'pwned', color: '#000000' })).status).toBe(404);
    expect((await call(bob, 'DELETE', `/projects/${projectId}`)).status).toBe(404);
    expect(await (await call(alice, 'GET', '/projects')).json()).toHaveLength(1);
    expect(await (await call(alice, 'GET', '/items')).json()).toHaveLength(1);
  });

  test('another user cannot create or move items into a foreign project', async () => {
    expect((await call(bob, 'POST', '/items', { name: 'x', projectId })).status).toBe(404);
    const own = await (await call(bob, 'POST', '/projects', { name: 'Bob', color: '#00ff00' })).json();
    const mine = await (await call(bob, 'POST', '/items', { name: 'mine', projectId: own.id })).json();
    expect((await call(bob, 'PUT', `/items/${mine.id}`, { name: 'mine', completed: false, projectId })).status).toBe(
      404
    );
  });

  test('a client cannot set userId on creation', async () => {
    const res = await call(bob, 'POST', '/items', { name: 'x', projectId, userId: alice.id });
    expect(res.status).toBe(422);
  });
});

describe('token revocation', () => {
  test('a token stops working after the password changes', async () => {
    const res = await call(alice, 'PUT', `/users/${alice.id}`, { password: 'another-long-password' });
    expect(res.status).toBe(200);
    expect((await call(alice, 'GET', '/items')).status).toBe(401);
    expect((await call(alice, 'GET', `/users/${alice.id}`)).status).toBe(401);
  });

  test('a fresh login after a password change gets a working token', async () => {
    await call(alice, 'PUT', `/users/${alice.id}`, { password: 'another-long-password' });
    const login = await call(null, 'POST', '/auth/login', {
      email: 'alice@example.com',
      password: 'another-long-password',
    });
    expect(login.status).toBe(200);
    const { token } = await login.json();
    const items = await app.request('/items', { headers: { Authorization: `Bearer ${token}` } });
    expect(items.status).toBe(200);
  });

  test('changing only the name keeps the token valid', async () => {
    expect((await call(alice, 'PUT', `/users/${alice.id}`, { name: 'Alice B' })).status).toBe(200);
    expect((await call(alice, 'GET', '/items')).status).toBe(200);
  });

  test('a token stops working once the account is deleted', async () => {
    expect((await call(alice, 'DELETE', `/users/${alice.id}`)).status).toBe(204);
    expect((await call(alice, 'GET', '/items')).status).toBe(401);
  });

  test('a token without a version is rejected', async () => {
    const { sign } = await import('hono/jwt');
    const token = await sign({ sub: alice.id, exp: Math.floor(Date.now() / 1000) + 60 }, process.env.JWT_SECRET!);
    const res = await app.request('/items', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });
});

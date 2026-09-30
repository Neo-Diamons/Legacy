import { resolveAllowedOrigins } from '@utils/cors.js';
import { userService } from '@service/user.service.js';
import { resetDb } from './test/db.js';
import { app, call, json, seedUser } from './test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
let alice: Session;

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
});

const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('route protection', () => {
  it.each([
    ['GET', '/items'],
    ['POST', '/items'],
    ['PUT', `/items/${id}`],
    ['DELETE', `/items/${id}`],
    ['GET', `/items/${id}/anything`],
    ['GET', '/projects'],
    ['POST', '/projects'],
    ['PUT', `/projects/${id}`],
    ['DELETE', `/projects/${id}`],
    ['GET', '/users'],
    ['GET', `/users/${id}`],
    ['PUT', `/users/${id}`],
    ['DELETE', `/users/${id}`],
    ['GET', `/users/${id}/export`],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
  });

  it.each([['/items'], ['/projects'], ['/users']])(
    '%s answers 401 for a revoked token',
    async (path) => {
      await userService.updateUser(alice.id, { passwordHash: 'new-hash' });
      expect((await call(alice, 'GET', path)).status).toBe(401);
    }
  );

  it.each([['/doc'], ['/scalar']])('serves %s without a token', async (path) => {
    expect((await app.request(path)).status).toBe(200);
  });

  it('leaves registration and login open', async () => {
    const register = await call(null, 'POST', '/auth/register', {
      email: 'open@example.com',
      name: 'Open',
      password: 'correct-horse-battery',
    });
    expect(register.status).toBe(201);
    expect(
      (await call(null, 'POST', '/auth/login', { email: 'open@example.com', password: 'correct-horse-battery' })).status
    ).toBe(200);
  });

  it('answers 404 with a JSON body for unknown routes', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Not found' });
  });

  it('does not expose the auth routes with the wrong method', async () => {
    expect((await app.request('/auth/login')).status).toBe(404);
    expect((await app.request('/auth/register')).status).toBe(404);
  });
});

describe('API documentation', () => {
  it('serves the OpenAPI document to an authenticated user', async () => {
    const res = await call(alice, 'GET', '/doc');
    const doc = await json(res);

    expect(res.status).toBe(200);
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info.title).toBe('Legacy');
  });

  it('documents every route of the API', async () => {
    const { paths } = await json(await call(alice, 'GET', '/doc'));
    const documented = Object.entries(paths).flatMap(([path, methods]) =>
      Object.keys(methods as object).map((method) => `${method.toUpperCase()} ${path}`)
    );

    expect(documented.sort()).toEqual(
      [
        'POST /auth/register',
        'POST /auth/login',
        'GET /items',
        'POST /items',
        'PUT /items/{id}',
        'DELETE /items/{id}',
        'GET /projects',
        'POST /projects',
        'PUT /projects/{id}',
        'DELETE /projects/{id}',
        'GET /users',
        'GET /users/{id}',
        'PUT /users/{id}',
        'DELETE /users/{id}',
        'GET /users/{id}/export',
        'POST /users/{id}/password',
      ].sort()
    );
  });

  it('never documents credentials as response fields', async () => {
    const text = await (await call(alice, 'GET', '/doc')).text();
    expect(text).not.toMatch(/passwordHash|password_hash|tokenVersion/);
  });

  it('serves the reference page to an authenticated user', async () => {
    const res = await call(alice, 'GET', '/scalar');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('CORS', () => {
  const [allowed] = resolveAllowedOrigins();

  it('lets an allowed origin call the API, including the preflight', async () => {
    const preflight = await app.request('/items', {
      method: 'OPTIONS',
      headers: {
        Origin: allowed,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });

    expect(preflight.headers.get('access-control-allow-origin')).toBe(allowed);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
  });

  it('adds the allow-origin header to real responses for an allowed origin', async () => {
    const res = await app.request('/items', { headers: { ...alice.headers, Origin: allowed } });
    expect(res.headers.get('access-control-allow-origin')).toBe(allowed);
  });

  it('does not allow other origins', async () => {
    for (const origin of ['https://evil.example.com', 'null']) {
      const res = await app.request('/items', { headers: { ...alice.headers, Origin: origin } });
      expect(res.headers.get('access-control-allow-origin')).not.toBe(origin);
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    }
  });

  it('never enables credentialed cross-origin requests', async () => {
    const res = await app.request('/items', { headers: { ...alice.headers, Origin: allowed } });
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });
});

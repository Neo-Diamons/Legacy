import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuthenticatedUserId, requireOwnUser } from '@http/identity.js';
import { registerErrorHandler } from '@http/app.js';
import type { OpenAPIHono } from '@hono/zod-openapi';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

/** Builds an app whose jwtPayload is whatever the test passes, so identity is tested without the JWT layer. */
function build(payload: unknown) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (payload !== undefined) c.set('jwtPayload', payload);
    await next();
  });
  app.get('/me', (c) => c.json({ id: getAuthenticatedUserId(c) }));
  app.get('/users/:id', (c) => c.json({ id: requireOwnUser(c, c.req.param('id')) }));
  registerErrorHandler(app as unknown as OpenAPIHono);
  return app;
}

describe('getAuthenticatedUserId', () => {
  it('returns the subject of the token', async () => {
    const res = await build({ sub: USER }).request('/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: USER });
  });

  it.each([
    ['no payload at all', undefined],
    ['a payload without a subject', {}],
    ['an empty subject', { sub: '' }],
  ])('answers 401 with %s', async (_name, payload) => {
    const res = await build(payload).request('/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Authentication required' });
  });

  it('does not fall back to a default user when NODE_ENV is test', async () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect((await build(undefined).request('/me')).status).toBe(401);
  });
});

describe('requireOwnUser', () => {
  it('returns the id when it matches the caller', async () => {
    const res = await build({ sub: USER }).request(`/users/${USER}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: USER });
  });

  it('answers 403 when the requested id belongs to someone else', async () => {
    const res = await build({ sub: USER }).request(`/users/${OTHER}`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: 'Access denied' });
  });

  it('answers 401 (not 403) when there is no caller at all', async () => {
    expect((await build(undefined).request(`/users/${USER}`)).status).toBe(401);
  });

  it('compares ids exactly, including case', async () => {
    const id = 'abcdef12-1111-4111-8111-abcdefabcdef';
    const res = await build({ sub: id.toUpperCase() }).request(`/users/${id}`);
    expect(res.status).toBe(403);
  });

  it('throws HTTPException so the error handler can format it', () => {
    const c = { get: () => undefined } as never;
    expect(() => requireOwnUser(c, USER)).toThrow(HTTPException);
  });
});

import { HTTPException } from 'hono/http-exception';
import { z } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { createRouter, registerErrorHandler } from '@http/app.js';

const build = () => {
  const app = createRouter();

  app.openapi(
    createRoute({
      method: 'post',
      path: '/validate',
      request: { body: { content: { 'application/json': { schema: z.object({ n: z.number() }) } } } },
      responses: { 200: { description: 'ok' } },
    }),
    (c) => c.body(null, 200)
  );

  app.get('/boom', () => {
    throw new Error('kaboom');
  });

  app.get('/teapot', () => {
    throw new HTTPException(418, { message: "I'm a teapot" });
  });

  registerErrorHandler(app);
  return app;
};

describe('http/app', () => {
  const app = build();

  test('defaultHook returns 422 with message + issues on validation failure', async () => {
    const res = await app.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: 'not-a-number' }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      message: 'Validation failed',
      issues: [{ path: ['n'], message: expect.any(String) }],
    });
  });

  test('onError maps an unexpected throw to 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: 'Internal server error' });
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  test('onError passes an HTTPException status + message through', async () => {
    const res = await app.request('/teapot');

    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ message: "I'm a teapot" });
  });

  test('notFound returns 404', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: 'Not found' });
  });
});

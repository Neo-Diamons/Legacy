import fs from 'fs';
import os from 'os';
import path from 'path';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getJwtSecret, jwtAuth, verifyToken } from '@http/auth.js';
import { registerErrorHandler } from '@http/app.js';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { userService } from '@service/user.service.js';
import { resetDb } from '../test/db.js';
import { issueToken, seedUser } from '../test/fixtures.js';

const SECRET = process.env.JWT_SECRET!;
const now = () => Math.floor(Date.now() / 1000);

describe('getJwtSecret', () => {
  const original = process.env.JWT_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  it('returns the configured secret', () => {
    expect(getJwtSecret()).toBe(original);
  });

  it.each([undefined, '', 'too-short', 'x'.repeat(31)])('refuses to run with the secret %j', (value) => {
    if (value === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = value;
    expect(() => getJwtSecret()).toThrow('JWT_SECRET must be set and contain at least 32 characters');
  });

  it('reads the secret from JWT_SECRET_FILE, trimmed, in preference to JWT_SECRET', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwt-'));
    const file = path.join(dir, 'jwt_secret.txt');
    fs.writeFileSync(file, `${'f'.repeat(32)}\n`);
    process.env.JWT_SECRET_FILE = file;
    try {
      expect(getJwtSecret()).toBe('f'.repeat(32));
    } finally {
      delete process.env.JWT_SECRET_FILE;
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('accepts exactly 32 characters', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    expect(getJwtSecret()).toBe('x'.repeat(32));
  });
});

describe('verifyToken', () => {
  beforeEach(resetDb);

  it('returns the user id of a valid, current token', async () => {
    const user = await seedUser('a@example.com');
    await expect(verifyToken(user.token)).resolves.toBe(user.id);
  });

  it('rejects a token signed with another secret', async () => {
    const user = await seedUser('a@example.com');
    const forged = await issueToken(user.id, 0, 3600, 'another-secret-that-is-32-characters!!');
    await expect(verifyToken(forged)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const user = await seedUser('a@example.com');
    await expect(verifyToken(await issueToken(user.id, 0, -10))).rejects.toThrow();
  });

  it('rejects a token signed with a different algorithm', async () => {
    const user = await seedUser('a@example.com');
    const token = await sign({ sub: user.id, tv: 0, exp: now() + 60 }, SECRET, 'HS512');
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('rejects an unsigned token (alg none)', async () => {
    const user = await seedUser('a@example.com');
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, tv: 0, exp: now() + 60 })}.`;
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token whose payload was tampered with', async () => {
    const a = await seedUser('a@example.com');
    const b = await seedUser('b@example.com');
    const [header, , signature] = a.token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: b.id, tv: 0, exp: now() + 60 })).toString('base64url');
    await expect(verifyToken(`${header}.${forgedPayload}.${signature}`)).rejects.toThrow();
  });

  it.each(['', 'garbage', 'a.b.c'])('rejects the malformed token %j', async (token) => {
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token without a subject', async () => {
    const token = await sign({ tv: 0, exp: now() + 60 }, SECRET);
    await expect(verifyToken(token)).rejects.toThrow('Session expired');
  });

  it('rejects a token for a user that does not exist', async () => {
    await expect(verifyToken(await issueToken(crypto.randomUUID()))).rejects.toThrow('Session expired');
  });

  it('rejects a token without a version', async () => {
    const user = await seedUser('a@example.com');
    const token = await sign({ sub: user.id, exp: now() + 60 }, SECRET);
    await expect(verifyToken(token)).rejects.toThrow('Session expired');
  });

  it('rejects a token whose version is stale, and accepts one with the new version', async () => {
    const user = await seedUser('a@example.com');
    await userService.updateUser(user.id, { passwordHash: 'new-hash' });

    await expect(verifyToken(user.token)).rejects.toThrow('Session expired');
    await expect(verifyToken(await issueToken(user.id, 1))).resolves.toBe(user.id);
  });

  it('rejects a token with a version from the future', async () => {
    const user = await seedUser('a@example.com');
    await expect(verifyToken(await issueToken(user.id, 5))).rejects.toThrow('Session expired');
  });

  it('rejects the token of a deleted user', async () => {
    const user = await seedUser('a@example.com');
    await userService.deleteUser(user.id);
    await expect(verifyToken(user.token)).rejects.toThrow('Session expired');
  });
});

describe('jwtAuth middleware', () => {
  beforeEach(resetDb);

  const app = new Hono();
  app.use('/protected', jwtAuth());
  app.get('/protected', (c) => c.json({ payload: c.get('jwtPayload') }));
  registerErrorHandler(app as unknown as OpenAPIHono);

  const get = (authorization?: string) =>
    app.request('/protected', { headers: authorization ? { Authorization: authorization } : {} });

  it('lets a valid token through and exposes its payload', async () => {
    const user = await seedUser('a@example.com');
    const res = await get(`Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect((await res.json()).payload).toMatchObject({ sub: user.id, tv: 0 });
  });

  it('answers 401 without an Authorization header', async () => {
    expect((await get()).status).toBe(401);
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer not-a-jwt', 'token'])(
    'answers 401 for the header %j',
    async (header) => {
      expect((await get(header)).status).toBe(401);
    }
  );

  it('answers 401 for an expired token', async () => {
    const user = await seedUser('a@example.com');
    expect((await get(`Bearer ${await issueToken(user.id, 0, -10)}`)).status).toBe(401);
  });

  it('answers 401 with "Session expired" once the token is revoked', async () => {
    const user = await seedUser('a@example.com');
    await userService.updateUser(user.id, { passwordHash: 'new-hash' });
    const res = await get(`Bearer ${user.token}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: 'Session expired' });
  });

  it('does not run the handler when it rejects', async () => {
    const handler = vi.fn((c) => c.text('ok'));
    const guarded = new Hono();
    guarded.use('*', jwtAuth());
    guarded.get('/', handler);
    registerErrorHandler(guarded as unknown as OpenAPIHono);

    await guarded.request('/');
    expect(handler).not.toHaveBeenCalled();
  });
});

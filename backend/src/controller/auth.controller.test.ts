import { decode } from 'hono/jwt';
import { userService } from '@service/user.service.js';
import { verifyPassword } from '@utils/password.js';
import { resetDb } from '../test/db.js';
import { PASSWORD, call, json, seedUser } from '../test/fixtures.js';

const register = (body: Record<string, unknown>) => call(null, 'POST', '/auth/register', body);
const login = (body: Record<string, unknown>) => call(null, 'POST', '/auth/login', body);
const valid = { email: 'alice@example.com', name: 'Alice', password: PASSWORD };

beforeEach(resetDb);

describe('POST /auth/register', () => {
  it('creates the account and answers 201 with a token and the public user', async () => {
    const res = await register(valid);
    expect(res.status).toBe(201);

    const body = await json(res);
    expect(body.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'alice@example.com',
      name: 'Alice',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      mustChangePassword: false,
    });
    expect(body.token).toEqual(expect.any(String));
    expect(await userService.getUser(body.user.id)).toBeDefined();
  });

  it('never returns the password, its hash or the token version', async () => {
    const text = await (await register(valid)).text();
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toMatch(/passwordHash|password_hash|scrypt|tokenVersion/);
  });

  it('stores only a salted scrypt hash of the password', async () => {
    await register(valid);
    const stored = await userService.getUserByEmail('alice@example.com');

    expect(stored?.passwordHash).toMatch(/^scrypt:/);
    expect(stored?.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored!.passwordHash)).toBe(true);
  });

  it('returns a token that authenticates the new user immediately', async () => {
    const { token, user } = await json(await register(valid));
    const res = await call(
      { id: user.id, email: user.email, token, headers: { Authorization: `Bearer ${token}` } },
      'GET',
      '/users'
    );

    expect(res.status).toBe(200);
    expect((await json(res))[0].id).toBe(user.id);
  });

  it('issues a token for that user, valid for about an hour, carrying the token version', async () => {
    const { token, user } = await json(await register(valid));
    const { payload } = decode(token);

    expect(payload.sub).toBe(user.id);
    expect(payload.tv).toBe(0);
    expect(payload.exp! - Math.floor(Date.now() / 1000)).toBeGreaterThan(3500);
    expect(payload.exp! - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(3600);
  });

  it('gives every account its own id', async () => {
    const a = await json(await register(valid));
    const b = await json(await register({ ...valid, email: 'bob@example.com' }));
    expect(a.user.id).not.toBe(b.user.id);
  });

  it('lower-cases the email', async () => {
    const res = await register({ ...valid, email: 'Alice@Example.COM' });
    expect((await json(res)).user.email).toBe('alice@example.com');
    expect(await userService.emailExists('alice@example.com')).toBe(true);
  });

  it('answers 409 when the email is already registered, whatever its case', async () => {
    await register(valid);
    for (const email of ['alice@example.com', 'ALICE@example.com']) {
      const res = await register({ ...valid, email, name: 'Impostor' });
      expect(res.status).toBe(409);
      expect(await json(res)).toEqual({ message: 'Email already registered' });
    }
    expect((await userService.getUserByEmail('alice@example.com'))?.name).toBe('Alice');
  });

  it('answers 409, not 500, when two registrations race for the same email', async () => {
    const results = await Promise.all([register(valid), register({ ...valid, name: 'Twin' })]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('accepts a password of exactly 12 characters', async () => {
    expect((await register({ ...valid, password: 'twelve-chars' })).status).toBe(201);
  });

  it.each([
    ['a missing email', { name: 'A', password: PASSWORD }],
    ['a missing name', { email: 'a@example.com', password: PASSWORD }],
    ['a missing password', { email: 'a@example.com', name: 'A' }],
    ['an invalid email', { ...valid, email: 'not-an-email' }],
    ['an email with surrounding spaces', { ...valid, email: ' alice@example.com ' }],
    ['an empty name', { ...valid, name: '' }],
    ['a password of 11 characters', { ...valid, password: 'eleven-char' }],
    ['a non-string password', { ...valid, password: 123456789012 }],
    ['a forged id', { ...valid, id: crypto.randomUUID() }],
    ['mustChangePassword', { ...valid, mustChangePassword: true }],
    ['a token version', { ...valid, tokenVersion: 9 }],
    ['a password hash', { ...valid, passwordHash: 'scrypt:a:b' }],
  ])('answers 422 for %s and creates nothing', async (_label, body) => {
    const res = await register(body);

    expect(res.status).toBe(422);
    expect((await json(res)).message).toBe('Validation failed');
    expect(await userService.emailExists('alice@example.com')).toBe(false);
  });

  it('enforces the column limits of the database (name and email up to 255 characters)', async () => {
    const email = (tld: number) => `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(tld)}`;

    expect((await register({ ...valid, name: 'n'.repeat(255) })).status).toBe(201);
    expect((await register({ ...valid, email: 'other@example.com', name: 'n'.repeat(256) })).status).toBe(422);
    expect((await register({ ...valid, email: email(62) })).status).toBe(201);
    expect((await register({ ...valid, email: email(63) })).status).toBe(422);
  });

  it('answers 4xx for a body that is not JSON', async () => {
    const res = await call(null, 'POST', '/auth/register');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('does not require authentication', async () => {
    expect((await register(valid)).status).toBe(201);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register(valid);
  });

  it('answers 200 with a token and the public user', async () => {
    const res = await login({ email: valid.email, password: PASSWORD });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.user).toMatchObject({ email: valid.email, name: 'Alice', mustChangePassword: false });
    expect(decode(body.token).payload.sub).toBe(body.user.id);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|scrypt|tokenVersion/);
  });

  it('matches the email case-insensitively', async () => {
    expect((await login({ email: 'ALICE@EXAMPLE.COM', password: PASSWORD })).status).toBe(200);
  });

  it('gives a token that is accepted by protected routes', async () => {
    const { token } = await json(await login({ email: valid.email, password: PASSWORD }));
    const res = await call(
      { id: '', email: '', token, headers: { Authorization: `Bearer ${token}` } },
      'GET',
      '/projects'
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ['a wrong password', { email: valid.email, password: 'wrong-password-123' }],
    ['a password differing by case', { email: valid.email, password: PASSWORD.toUpperCase() }],
    ['an unknown email', { email: 'nobody@example.com', password: PASSWORD }],
  ])('answers 401 with the same message for %s', async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ message: 'Invalid credentials' });
  });

  it('cannot log into an account whose stored hash is the unusable placeholder', async () => {
    await seedUser('placeholder@example.com');
    const res = await login({ email: 'placeholder@example.com', password: 'unusable' });
    expect(res.status).toBe(401);
  });

  it.each([
    ['a missing password', { email: valid.email }],
    ['an empty password', { email: valid.email, password: '' }],
    ['a missing email', { password: PASSWORD }],
    ['an invalid email', { email: 'nope', password: PASSWORD }],
    ['unexpected fields', { email: valid.email, password: PASSWORD, admin: true }],
  ])('answers 422 for %s', async (_label, body) => {
    expect((await login(body)).status).toBe(422);
  });

  it('reports mustChangePassword for accounts that must pick a new password', async () => {
    await seedUser('legacy@example.com', { password: 'LegacyUser123!', mustChangePassword: true });

    const body = await json(await login({ email: 'legacy@example.com', password: 'LegacyUser123!' }));

    expect(body.user.mustChangePassword).toBe(true);
    expect(decode(body.token).payload.mustChangePassword).toBe(true);
  });

  it('gives a token with the current token version after a password change bumped it', async () => {
    const { user, token } = await json(await login({ email: valid.email, password: PASSWORD }));
    const session = {
      id: user.id,
      email: user.email,
      token,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    await call(session, 'PUT', `/users/${user.id}`, { password: 'a-brand-new-password' });

    const fresh = await json(await login({ email: valid.email, password: 'a-brand-new-password' }));

    expect(decode(fresh.token).payload.tv).toBe(1);
    expect((await login({ email: valid.email, password: PASSWORD })).status).toBe(401);
  });
});

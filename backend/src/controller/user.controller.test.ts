import { decode } from 'hono/jwt';
import { userService } from '@service/user.service.js';
import { projectService } from '@service/project.service.js';
import { itemService } from '@service/item.service.js';
import { resetDb } from '../test/db.js';
import { PASSWORD, call, issueToken, json, seedItem, seedProject, seedUser, sessionFor } from '../test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
let alice: Session;
let bob: Session;

const login = (email: string, password: string) => call(null, 'POST', '/auth/login', { email, password });

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com', { password: PASSWORD });
  bob = await seedUser('bob@example.com', { password: PASSWORD });
});

describe('authentication', () => {
  it.each([
    ['GET', '/users'],
    ['GET', `/users/${crypto.randomUUID()}`],
    ['PUT', `/users/${crypto.randomUUID()}`],
    ['POST', `/users/${crypto.randomUUID()}/password`],
    ['DELETE', `/users/${crypto.randomUUID()}`],
    ['GET', `/users/${crypto.randomUUID()}/export`],
  ])('%s %s answers 401 without a token', async (method, path) => {
    expect((await call(null, method, path, method === 'PUT' ? { name: 'x' } : method === 'POST' ? { currentPassword: 'x', newPassword: 'y' } : undefined)).status).toBe(401);
  });
});

describe('GET /users', () => {
  it('returns only the caller, as a public user', async () => {
    const res = await call(alice, 'GET', '/users');

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual([
      {
        id: alice.id,
        email: 'alice@example.com',
        name: 'alice',
        createdAt: expect.any(String),
        mustChangePassword: false,
      },
    ]);
  });
});

describe('GET /users/:id', () => {
  it('returns the caller without secrets', async () => {
    const res = await call(alice, 'GET', `/users/${alice.id}`);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ id: alice.id, email: 'alice@example.com' });
    expect(Object.keys(body).sort()).toEqual(['createdAt', 'email', 'id', 'mustChangePassword', 'name']);
  });

  it('answers 403 for another existing user and for a user that does not exist', async () => {
    expect((await call(alice, 'GET', `/users/${bob.id}`)).status).toBe(403);
    expect((await call(alice, 'GET', `/users/${crypto.randomUUID()}`)).status).toBe(403);
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await call(alice, 'GET', '/users/not-a-uuid')).status).toBe(422);
  });
});

describe('POST /users/:id/password', () => {
  const NEW_PASSWORD = 'a-brand-new-password';
  const change = (session: Session, body: unknown, id = session.id) =>
    call(session, 'POST', `/users/${id}/password`, body);

  it('changes the password when the current one is right, and answers with a fresh session', async () => {
    const res = await change(alice, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.user).toMatchObject({ id: alice.id, email: 'alice@example.com', mustChangePassword: false });
    expect(Object.keys(body.user).sort()).toEqual(['createdAt', 'email', 'id', 'mustChangePassword', 'name']);
    expect(decode(body.token).payload.tv).toBe(1);
    expect((await call({ ...alice, headers: { ...alice.headers, Authorization: `Bearer ${body.token}` } }, 'GET', '/users')).status).toBe(200);
    expect((await login('alice@example.com', NEW_PASSWORD)).status).toBe(200);
    expect((await login('alice@example.com', PASSWORD)).status).toBe(401);
  });

  it('revokes the token used for the request and every older one', async () => {
    const other = await sessionFor(alice.id, alice.email, 0);
    await change(alice, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    for (const stale of [alice, other]) expect((await call(stale, 'GET', '/users')).status).toBe(401);
    expect((await call(bob, 'GET', '/users')).status).toBe(200);
  });

  it('answers 403, without changing anything or revoking the session, when the current password is wrong', async () => {
    const res = await change(alice, { currentPassword: 'not-the-password', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({ message: 'Current password is incorrect' });
    expect((await login('alice@example.com', PASSWORD)).status).toBe(200);
    expect((await login('alice@example.com', NEW_PASSWORD)).status).toBe(401);
    expect((await call(alice, 'GET', '/users')).status).toBe(200);
    expect(await userService.getTokenVersion(alice.id)).toBe(0);
  });

  it('answers 422 for a new password shorter than 12 characters or a missing field', async () => {
    expect((await change(alice, { currentPassword: PASSWORD, newPassword: 'too-short' })).status).toBe(422);
    expect((await change(alice, { newPassword: NEW_PASSWORD })).status).toBe(422);
    expect((await change(alice, { currentPassword: PASSWORD })).status).toBe(422);
    expect((await change(alice, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, name: 'x' })).status).toBe(422);
    expect((await login('alice@example.com', PASSWORD)).status).toBe(200);
  });

  it('answers 403 for another user, without touching their password', async () => {
    const res = await change(alice, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, bob.id);

    expect(res.status).toBe(403);
    expect((await login('bob@example.com', PASSWORD)).status).toBe(200);
  });

  it('clears the forced password change flag', async () => {
    const legacy = await seedUser('legacy@example.com', { password: 'LegacyUser123!', mustChangePassword: true });
    const res = await change(legacy, { currentPassword: 'LegacyUser123!', newPassword: NEW_PASSWORD });

    expect((await json(res)).user.mustChangePassword).toBe(false);
  });
});

describe('PUT /users/:id', () => {
  const put = (session: Session, body: unknown, id = session.id) => call(session, 'PUT', `/users/${id}`, body);

  it('renames the user and keeps everything else, including the session', async () => {
    const res = await put(alice, { name: 'Alice Cooper' });

    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: alice.id, name: 'Alice Cooper', email: 'alice@example.com' });
    expect((await call(alice, 'GET', '/users')).status).toBe(200);
    expect((await login('alice@example.com', PASSWORD)).status).toBe(200);
  });

  it('changes the email (lower-cased) and frees the old one', async () => {
    const res = await put(alice, { email: 'New.Alice@Example.com' });

    expect((await json(res)).email).toBe('new.alice@example.com');
    expect((await login('new.alice@example.com', PASSWORD)).status).toBe(200);
    expect((await login('alice@example.com', PASSWORD)).status).toBe(401);
    expect(await userService.emailExists('alice@example.com')).toBe(false);
  });

  it('accepts re-submitting the caller own email', async () => {
    expect((await put(alice, { email: 'ALICE@example.com', name: 'Same' })).status).toBe(200);
  });

  it('answers 409 when the email belongs to another user, and changes nothing', async () => {
    const res = await put(alice, { email: 'bob@example.com', name: 'Should not apply' });

    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ message: 'Email already registered' });
    expect(await userService.getUser(alice.id)).toMatchObject({ email: 'alice@example.com', name: 'alice' });
    expect(await userService.getUser(bob.id)).toMatchObject({ email: 'bob@example.com' });
  });

  it('is a no-op that still answers 200 for an empty body', async () => {
    const res = await put(alice, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: alice.id, name: 'alice' });
    expect(await userService.getTokenVersion(alice.id)).toBe(0);
  });

  describe('changing the password', () => {
    it('lets the user log in with the new password only', async () => {
      const res = await put(alice, { password: 'a-brand-new-password' });

      expect(res.status).toBe(200);
      expect((await login('alice@example.com', 'a-brand-new-password')).status).toBe(200);
      expect((await login('alice@example.com', PASSWORD)).status).toBe(401);
    });

    it('stores a fresh scrypt hash, not the plaintext', async () => {
      const before = (await userService.getUserByEmail('alice@example.com'))!.passwordHash;
      await put(alice, { password: 'a-brand-new-password' });
      const after = (await userService.getUserByEmail('alice@example.com'))!.passwordHash;

      expect(after).toMatch(/^scrypt:/);
      expect(after).not.toBe(before);
      expect(after).not.toContain('a-brand-new-password');
    });

    it('revokes the token used for the request, and every older one', async () => {
      const other = await sessionFor(alice.id, alice.email, 0);
      await put(alice, { password: 'a-brand-new-password' });

      for (const stale of [alice, other]) {
        expect((await call(stale, 'GET', '/users')).status).toBe(401);
        expect((await call(stale, 'GET', '/items')).status).toBe(401);
        expect((await call(stale, 'GET', '/projects')).status).toBe(401);
      }
    });

    it('does not revoke the sessions of other users', async () => {
      await put(alice, { password: 'a-brand-new-password' });
      expect((await call(bob, 'GET', '/users')).status).toBe(200);
    });

    it('issues tokens with the new version at the next login', async () => {
      await put(alice, { password: 'a-brand-new-password' });
      const { token } = await json(await login('alice@example.com', 'a-brand-new-password'));

      expect(decode(token).payload.tv).toBe(1);
      expect((await call(await sessionFor(alice.id, alice.email, 1), 'GET', '/users')).status).toBe(200);
    });

    it('keeps revoking with each further change', async () => {
      await put(alice, { password: 'a-brand-new-password' });
      const second = await sessionFor(alice.id, alice.email, 1);
      await put(second, { password: 'yet-another-password' });

      expect((await call(second, 'GET', '/users')).status).toBe(401);
      expect((await call(await sessionFor(alice.id, alice.email, 2), 'GET', '/users')).status).toBe(200);
    });

    it('clears the forced password change flag', async () => {
      const legacy = await seedUser('legacy@example.com', { password: 'LegacyUser123!', mustChangePassword: true });
      expect((await json(await call(legacy, 'GET', `/users/${legacy.id}`))).mustChangePassword).toBe(true);

      const res = await put(legacy, { password: 'a-brand-new-password' });

      expect((await json(res)).mustChangePassword).toBe(false);
      const fresh = await json(await login('legacy@example.com', 'a-brand-new-password'));
      expect(fresh.user.mustChangePassword).toBe(false);
    });

    it('keeps the forced password change flag when only other fields change', async () => {
      const legacy = await seedUser('legacy@example.com', { password: 'LegacyUser123!', mustChangePassword: true });
      const res = await put(legacy, { name: 'Renamed' });

      expect((await json(res)).mustChangePassword).toBe(true);
    });
  });

  it.each([
    ['a password of 11 characters', { password: 'eleven-char' }],
    ['an invalid email', { email: 'nope' }],
    ['an empty name', { name: '' }],
    ['a name longer than 255 characters', { name: 'n'.repeat(256) }],
    ['mustChangePassword', { mustChangePassword: false }],
    ['a token version', { tokenVersion: 0 }],
    ['an id', { id: crypto.randomUUID() }],
    ['a password hash', { passwordHash: 'scrypt:a:b' }],
  ])('answers 422 for %s and changes nothing', async (_label, body) => {
    const res = await put(alice, body);

    expect(res.status).toBe(422);
    expect(await userService.getUserByEmail('alice@example.com')).toMatchObject({ name: 'alice', tokenVersion: 0 });
  });

  it('answers 403 for another user and does not change them', async () => {
    const res = await put(alice, { name: 'Hacked', password: 'attacker-password-1' }, bob.id);

    expect(res.status).toBe(403);
    expect(await userService.getUser(bob.id)).toMatchObject({ name: 'bob' });
    expect((await login('bob@example.com', PASSWORD)).status).toBe(200);
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await put(alice, { name: 'x' }, 'nope')).status).toBe(422);
  });
});

describe('DELETE /users/:id', () => {
  it('answers 204 and removes the account for good', async () => {
    const res = await call(alice, 'DELETE', `/users/${alice.id}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await userService.getUser(alice.id)).toBeUndefined();
    expect((await login('alice@example.com', PASSWORD)).status).toBe(401);
  });

  it('kills the token of the deleted account', async () => {
    await call(alice, 'DELETE', `/users/${alice.id}`);

    expect((await call(alice, 'GET', '/users')).status).toBe(401);
    expect((await call(alice, 'DELETE', `/users/${alice.id}`)).status).toBe(401);
  });

  it('deletes the projects and items of the user, and only theirs', async () => {
    const aliceProject = await seedProject(alice.id);
    const aliceItem = await seedItem(alice.id, aliceProject);
    const bobProject = await seedProject(bob.id);
    const bobItem = await seedItem(bob.id, bobProject);

    await call(alice, 'DELETE', `/users/${alice.id}`);

    expect(await projectService.getProject(aliceProject, alice.id)).toBeUndefined();
    expect(await itemService.getItem(aliceItem.id, alice.id)).toBeUndefined();
    expect(await projectService.getProject(bobProject, bob.id)).toBeDefined();
    expect(await itemService.getItem(bobItem.id, bob.id)).toEqual(bobItem);
  });

  it('lets the same email register again with a clean slate', async () => {
    await call(alice, 'DELETE', `/users/${alice.id}`);

    const res = await call(null, 'POST', '/auth/register', {
      email: 'alice@example.com',
      name: 'New',
      password: PASSWORD,
    });
    const { user, token } = await json(res);

    expect(res.status).toBe(201);
    expect(user.id).not.toBe(alice.id);
    const fresh = await sessionFor(user.id, user.email);
    expect(await json(await call(fresh, 'GET', '/projects'))).toEqual([]);
    expect(token).toEqual(expect.any(String));
  });

  it('answers 403 for another user and deletes nothing', async () => {
    const res = await call(alice, 'DELETE', `/users/${bob.id}`);

    expect(res.status).toBe(403);
    expect(await userService.getUser(bob.id)).toBeDefined();
  });

  it('answers 422 for an id that is not a uuid', async () => {
    expect((await call(alice, 'DELETE', '/users/nope')).status).toBe(422);
  });
});

describe('GET /users/:id/export', () => {
  it('exports the caller data: profile, projects and items', async () => {
    const project = await seedProject(alice.id, 'Work');
    const item = await seedItem(alice.id, project, { name: 'Ship it' });

    const res = await call(alice, 'GET', `/users/${alice.id}/export`);
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.user).toMatchObject({ id: alice.id, email: 'alice@example.com' });
    expect(body.projects).toEqual([expect.objectContaining({ id: project, name: 'Work' })]);
    expect(body.items).toEqual([expect.objectContaining({ id: item.id, name: 'Ship it', projectId: project })]);
  });

  it('contains nothing that belongs to another user', async () => {
    await seedItem(bob.id, await seedProject(bob.id, 'Bobs project'), { name: 'Bobs secret' });
    await seedItem(alice.id, await seedProject(alice.id));

    const text = await (await call(alice, 'GET', `/users/${alice.id}/export`)).text();

    expect(text).not.toContain('Bobs secret');
    expect(text).not.toContain('Bobs project');
    expect(text).not.toContain('bob@example.com');
    expect(text).not.toContain(bob.id);
  });

  it('never contains the password hash or the token version', async () => {
    const text = await (await call(alice, 'GET', `/users/${alice.id}/export`)).text();

    expect(text).not.toMatch(/passwordHash|password_hash|scrypt|tokenVersion|token_version/);
  });

  it('answers 403 for another user', async () => {
    expect((await call(alice, 'GET', `/users/${bob.id}/export`)).status).toBe(403);
  });

  it('answers 401 when the token is stale', async () => {
    const stale = await sessionFor(alice.id, alice.email, 7);
    expect((await call(stale, 'GET', `/users/${alice.id}/export`)).status).toBe(401);
  });
});

describe('tokens for someone who is not the caller', () => {
  it('cannot be forged by signing with another secret', async () => {
    const token = await issueToken(alice.id, 0, 3600, 'a-different-secret-of-32-characters!!');
    const res = await call(
      { id: alice.id, email: '', token, headers: { Authorization: `Bearer ${token}` } },
      'GET',
      '/users'
    );
    expect(res.status).toBe(401);
  });
});

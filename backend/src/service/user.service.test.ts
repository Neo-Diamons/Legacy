import { userService } from '@service/user.service.js';
import { resetDb } from '../test/db.js';
import { seedItem, seedProject, seedUser } from '../test/fixtures.js';
import { itemService } from '@service/item.service.js';
import { projectService } from '@service/project.service.js';

const newUser = (overrides: Partial<Parameters<typeof userService.createUser>[0]> = {}) => ({
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'User',
  passwordHash: 'scrypt:salt:key',
  mustChangePassword: false,
  tokenVersion: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  privacyConsentAt: null,
  privacyPolicyVersion: null,
  ...overrides,
});

beforeEach(resetDb);

describe('createUser / getUser / getUserByEmail', () => {
  it('stores a user and reads it back without secrets', async () => {
    const user = newUser({ mustChangePassword: true });
    await userService.createUser(user);

    const found = await userService.getUser(user.id);
    expect(found).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      mustChangePassword: true,
      createdAt: user.createdAt,
      privacyConsentAt: null,
      privacyPolicyVersion: null,
    });
    expect(found).not.toHaveProperty('passwordHash');
    expect(found).not.toHaveProperty('tokenVersion');
  });

  it('getUserByEmail returns the row including the hash and token version', async () => {
    const user = newUser({ passwordHash: 'scrypt:a:b', tokenVersion: 3 });
    await userService.createUser(user);

    expect(await userService.getUserByEmail(user.email)).toEqual(user);
  });

  it('defaults new accounts to token version 0', async () => {
    const user = newUser();
    await userService.createUser(user);
    expect(await userService.getTokenVersion(user.id)).toBe(0);
  });

  it('returns undefined for unknown ids and emails', async () => {
    expect(await userService.getUser(crypto.randomUUID())).toBeUndefined();
    expect(await userService.getUserByEmail('nobody@example.com')).toBeUndefined();
    expect(await userService.getTokenVersion(crypto.randomUUID())).toBeUndefined();
  });

  it('rejects a second user with the same email', async () => {
    await userService.createUser(newUser());
    await expect(userService.createUser(newUser({ id: crypto.randomUUID() }))).rejects.toThrow();
    expect(await userService.getUserByEmail('user@example.com')).toBeDefined();
  });

  it('rejects a second user with the same id', async () => {
    const user = newUser();
    await userService.createUser(user);
    await expect(userService.createUser(newUser({ id: user.id, email: 'other@example.com' }))).rejects.toThrow();
  });
});

describe('emailExists', () => {
  it('is true only for stored emails', async () => {
    await userService.createUser(newUser());
    expect(await userService.emailExists('user@example.com')).toBe(true);
    expect(await userService.emailExists('other@example.com')).toBe(false);
  });
});

describe('updateUser', () => {
  it('changes only the given fields and reports one changed row', async () => {
    const user = newUser();
    await userService.createUser(user);

    expect(await userService.updateUser(user.id, { name: 'Renamed' })).toBe(1);

    expect(await userService.getUserByEmail(user.email)).toEqual({ ...user, name: 'Renamed' });
  });

  it('can change the email', async () => {
    const user = newUser();
    await userService.createUser(user);
    await userService.updateUser(user.id, { email: 'new@example.com' });

    expect(await userService.getUserByEmail('user@example.com')).toBeUndefined();
    expect((await userService.getUserByEmail('new@example.com'))?.id).toBe(user.id);
  });

  it('can clear mustChangePassword without touching the token version', async () => {
    const user = newUser({ mustChangePassword: true });
    await userService.createUser(user);
    await userService.updateUser(user.id, { mustChangePassword: false });

    expect((await userService.getUser(user.id))?.mustChangePassword).toBe(false);
    expect(await userService.getTokenVersion(user.id)).toBe(0);
  });

  it('returns 0 for an unknown user', async () => {
    expect(await userService.updateUser(crypto.randomUUID(), { name: 'x' })).toBe(0);
  });

  it('does not touch other users', async () => {
    const a = newUser();
    const b = newUser({ id: crypto.randomUUID(), email: 'b@example.com' });
    await userService.createUser(a);
    await userService.createUser(b);

    await userService.updateUser(a.id, { name: 'Changed', passwordHash: 'new' });

    expect(await userService.getUserByEmail(b.email)).toEqual(b);
  });

  it('refuses to move an email onto one that already exists', async () => {
    const a = newUser();
    const b = newUser({ id: crypto.randomUUID(), email: 'b@example.com' });
    await userService.createUser(a);
    await userService.createUser(b);

    await expect(userService.updateUser(b.id, { email: a.email })).rejects.toThrow();
    expect((await userService.getUserByEmail(b.email))?.id).toBe(b.id);
  });

  describe('token version', () => {
    it('is bumped by exactly one when the password hash changes', async () => {
      const user = newUser();
      await userService.createUser(user);

      await userService.updateUser(user.id, { passwordHash: 'hash-2' });
      expect(await userService.getTokenVersion(user.id)).toBe(1);
      expect((await userService.getUserByEmail(user.email))?.passwordHash).toBe('hash-2');

      await userService.updateUser(user.id, { passwordHash: 'hash-3' });
      expect(await userService.getTokenVersion(user.id)).toBe(2);
    });

    it('is bumped once even when other fields change in the same update', async () => {
      const user = newUser();
      await userService.createUser(user);
      await userService.updateUser(user.id, { passwordHash: 'hash-2', name: 'Both', email: 'both@example.com' });

      expect(await userService.getTokenVersion(user.id)).toBe(1);
      expect((await userService.getUser(user.id))?.name).toBe('Both');
    });

    it('is not bumped by name or email changes', async () => {
      const user = newUser();
      await userService.createUser(user);
      await userService.updateUser(user.id, { name: 'A' });
      await userService.updateUser(user.id, { email: 'a@example.com' });

      expect(await userService.getTokenVersion(user.id)).toBe(0);
    });

    it('increments from the stored value, not from a cached one', async () => {
      const user = newUser({ tokenVersion: 41 });
      await userService.createUser(user);
      await userService.updateUser(user.id, { passwordHash: 'hash-2' });

      expect(await userService.getTokenVersion(user.id)).toBe(42);
    });

    it('only affects the user being updated', async () => {
      const a = newUser();
      const b = newUser({ id: crypto.randomUUID(), email: 'b@example.com' });
      await userService.createUser(a);
      await userService.createUser(b);
      await userService.updateUser(a.id, { passwordHash: 'hash-2' });

      expect(await userService.getTokenVersion(b.id)).toBe(0);
    });
  });
});

describe('deleteUser', () => {
  it('removes the user together with their projects and items', async () => {
    const owner = await seedUser('owner@example.com');
    const project = await seedProject(owner.id);
    const item = await seedItem(owner.id, project);

    expect(await userService.deleteUser(owner.id)).toBe(1);

    expect(await userService.getUser(owner.id)).toBeUndefined();
    expect(await projectService.getProject(project, owner.id)).toBeUndefined();
    expect(await itemService.getItem(item.id, owner.id)).toBeUndefined();
  });

  it('leaves every other user and their data alone', async () => {
    const owner = await seedUser('owner@example.com');
    const other = await seedUser('other@example.com');
    await seedItem(owner.id, await seedProject(owner.id));
    const otherProject = await seedProject(other.id);
    const otherItem = await seedItem(other.id, otherProject);

    await userService.deleteUser(owner.id);

    expect(await userService.getUser(other.id)).toBeDefined();
    expect(await projectService.getProject(otherProject, other.id)).toBeDefined();
    expect(await itemService.getItem(otherItem.id, other.id)).toBeDefined();
  });

  it('returns 0 for an unknown user', async () => {
    expect(await userService.deleteUser(crypto.randomUUID())).toBe(0);
  });

  it('frees the email for a new registration', async () => {
    const owner = await seedUser('owner@example.com');
    await userService.deleteUser(owner.id);
    await expect(userService.createUser(newUser({ email: 'owner@example.com' }))).resolves.toBeUndefined();
  });
});

describe('exportUserData', () => {
  it('returns undefined for an unknown user', async () => {
    expect(await userService.exportUserData(crypto.randomUUID())).toBeUndefined();
  });

  it('contains the user, their projects and their items, and nothing else', async () => {
    const owner = await seedUser('owner@example.com');
    const other = await seedUser('other@example.com');
    const ownerProject = await seedProject(owner.id, 'Mine');
    const ownerItem = await seedItem(owner.id, ownerProject, { name: 'Mine' });
    await seedItem(other.id, await seedProject(other.id, 'Theirs'), { name: 'Theirs' });

    const data = await userService.exportUserData(owner.id);

    expect(data?.user).toMatchObject({ id: owner.id, email: 'owner@example.com' });
    expect(data?.projects).toHaveLength(1);
    expect(data?.projects[0]).toMatchObject({ id: ownerProject, name: 'Mine', userId: owner.id });
    expect(data?.items).toEqual([ownerItem]);
  });

  it('never includes the password hash or token version of the user', async () => {
    const owner = await seedUser('owner@example.com');
    const data = await userService.exportUserData(owner.id);

    expect(data?.user).not.toHaveProperty('passwordHash');
    expect(data?.user).not.toHaveProperty('tokenVersion');
    expect(JSON.stringify(data)).not.toContain('unusable');
  });

  it('returns empty lists for a user without data', async () => {
    const owner = await seedUser('owner@example.com');
    expect(await userService.exportUserData(owner.id)).toMatchObject({ projects: [], items: [] });
  });
});

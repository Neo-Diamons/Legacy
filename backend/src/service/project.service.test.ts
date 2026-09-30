import { projectService } from '@service/project.service.js';
import { itemService } from '@service/item.service.js';
import { resetDb } from '../test/db.js';
import { seedItem, seedProject, seedUser } from '../test/fixtures.js';

let alice: Awaited<ReturnType<typeof seedUser>>;
let bob: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com');
  bob = await seedUser('bob@example.com');
});

describe('createProject / getProject / getProjects', () => {
  it('stores a project and reads it back', async () => {
    const project = {
      id: crypto.randomUUID(),
      userId: alice.id,
      name: 'Work',
      color: '#ff0000',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    await projectService.createProject(project);

    expect(await projectService.getProject(project.id, alice.id)).toEqual(project);
    expect(await projectService.getProjects(alice.id)).toEqual([project]);
  });

  it('lists only the projects of the given user', async () => {
    const mine = await seedProject(alice.id, 'Mine');
    await seedProject(bob.id, 'Theirs');

    const projects = await projectService.getProjects(alice.id);
    expect(projects.map((p) => p.id)).toEqual([mine]);
  });

  it('returns an empty list for a user with no projects', async () => {
    expect(await projectService.getProjects(alice.id)).toEqual([]);
  });

  it('does not return a project through another user', async () => {
    const id = await seedProject(alice.id);
    expect(await projectService.getProject(id, bob.id)).toBeUndefined();
  });

  it('returns undefined for an unknown id', async () => {
    expect(await projectService.getProject(crypto.randomUUID(), alice.id)).toBeUndefined();
  });

  it('refuses a project for a user that does not exist', async () => {
    await expect(
      projectService.createProject({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        name: 'Orphan',
        color: '#000000',
        createdAt: new Date(),
      })
    ).rejects.toThrow();
  });

  it('refuses a duplicate id', async () => {
    const id = await seedProject(alice.id);
    await expect(
      projectService.createProject({ id, userId: bob.id, name: 'Dup', color: '#000000', createdAt: new Date() })
    ).rejects.toThrow();
    expect((await projectService.getProject(id, alice.id))?.name).toBe('Project');
  });
});

describe('updateProject', () => {
  it('updates name and colour and reports one changed row', async () => {
    const id = await seedProject(alice.id, 'Old', '#111111');

    expect(await projectService.updateProject(id, alice.id, { name: 'New', color: '#222222' })).toBe(1);

    expect(await projectService.getProject(id, alice.id)).toMatchObject({ name: 'New', color: '#222222' });
  });

  it('supports changing a single field', async () => {
    const id = await seedProject(alice.id, 'Old', '#111111');
    await projectService.updateProject(id, alice.id, { name: 'Only name' });

    expect(await projectService.getProject(id, alice.id)).toMatchObject({ name: 'Only name', color: '#111111' });
  });

  it('does not let another user change the project', async () => {
    const id = await seedProject(alice.id, 'Old');

    expect(await projectService.updateProject(id, bob.id, { name: 'Hacked' })).toBe(0);
    expect((await projectService.getProject(id, alice.id))?.name).toBe('Old');
  });

  it('returns 0 for an unknown project', async () => {
    expect(await projectService.updateProject(crypto.randomUUID(), alice.id, { name: 'x' })).toBe(0);
  });

  it('never changes the owner', async () => {
    const id = await seedProject(alice.id);
    await projectService.updateProject(id, alice.id, { name: 'x', userId: bob.id } as never);
    expect(await projectService.getProject(id, bob.id)).toBeUndefined();
    expect(await projectService.getProject(id, alice.id)).toBeDefined();
  });
});

describe('deleteProject', () => {
  it('deletes the project and the items inside it', async () => {
    const id = await seedProject(alice.id);
    const item = await seedItem(alice.id, id);

    expect(await projectService.deleteProject(id, alice.id)).toBe(1);

    expect(await projectService.getProject(id, alice.id)).toBeUndefined();
    expect(await itemService.getItem(item.id, alice.id)).toBeUndefined();
  });

  it('keeps the items of the other projects of the same user', async () => {
    const doomed = await seedProject(alice.id, 'Doomed');
    const kept = await seedProject(alice.id, 'Kept');
    await seedItem(alice.id, doomed);
    const survivor = await seedItem(alice.id, kept);

    await projectService.deleteProject(doomed, alice.id);

    expect(await itemService.getItems(alice.id)).toEqual([survivor]);
    expect(await projectService.getProject(kept, alice.id)).toBeDefined();
  });

  it('does not let another user delete the project or its items', async () => {
    const id = await seedProject(alice.id);
    const item = await seedItem(alice.id, id);

    expect(await projectService.deleteProject(id, bob.id)).toBe(0);

    expect(await projectService.getProject(id, alice.id)).toBeDefined();
    expect(await itemService.getItem(item.id, alice.id)).toEqual(item);
  });

  it('returns 0 for an unknown project', async () => {
    expect(await projectService.deleteProject(crypto.randomUUID(), alice.id)).toBe(0);
  });
});

import { sign } from 'hono/jwt';
import { createApp } from '../app.js';
import { projectService } from '@service/project.service.js';
import { userService } from '@service/user.service.js';
import { itemService } from '@service/item.service.js';
import { hashPassword } from '@utils/password.js';

export const { app, injectWebSocket } = createApp({ log: false });

export const PASSWORD = 'correct-horse-battery';

export type Session = { id: string; email: string; token: string; headers: Record<string, string> };

export function issueToken(userId: string, tokenVersion = 0, expiresInSeconds = 3600, secret?: string) {
  return sign(
    { sub: userId, tv: tokenVersion, exp: Math.floor(Date.now() / 1000) + expiresInSeconds },
    secret ?? process.env.JWT_SECRET!
  );
}

/** Inserts a user straight into the database (skipping scrypt) and returns a valid session for it. */
export async function seedUser(email: string, overrides: { password?: string; mustChangePassword?: boolean } = {}) {
  const id = crypto.randomUUID();
  await userService.createUser({
    id,
    email,
    name: email.split('@')[0],
    passwordHash: overrides.password ? await hashPassword(overrides.password) : 'unusable',
    mustChangePassword: overrides.mustChangePassword ?? false,
    tokenVersion: 0,
    createdAt: new Date(),
  });
  return sessionFor(id, email);
}

export async function sessionFor(id: string, email: string, tokenVersion = 0): Promise<Session> {
  const token = await issueToken(id, tokenVersion);
  return { id, email, token, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export async function seedProject(userId: string, name = 'Project', color = '#123456') {
  const id = crypto.randomUUID();
  await projectService.createProject({ id, userId, name, color, createdAt: new Date() });
  return id;
}

export async function seedItem(
  userId: string,
  projectId: string,
  overrides: Partial<Parameters<typeof itemService.storeItem>[0]> = {}
) {
  const item = {
    id: crypto.randomUUID(),
    userId,
    projectId,
    name: 'Item',
    description: null,
    completed: false,
    priority: 'medium' as const,
    dueDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
  await itemService.storeItem(item);
  return item;
}

export function call(session: Session | null, method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: session?.headers ?? { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const json = async <T = any>(res: Response): Promise<T> => (await res.json()) as T;

import { serve, type ServerType } from '@hono/node-server';
import { WSContext } from 'hono/ws';
import { WebSocket } from 'ws';
import { sign } from 'hono/jwt';
import { createRouter } from '@http/app.js';
import { broadcastItemEvent, clientOwners, clients, registerWebSocket } from '@ws/broadcast.js';

vi.mock('@service/user.service.js', () => ({ userService: { getTokenVersion: async () => 0 } }));

process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

async function connect(port: number, owner = OWNER) {
  const token = await sign({ sub: owner, tv: 0, exp: Math.floor(Date.now() / 1000) + 60 }, process.env.JWT_SECRET!);
  const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token}`);
  await waitForOpen(ws);
  return ws;
}

function startServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const app = createRouter();
    const injectWebSocket = registerWebSocket(app);

    const server: ServerType = serve({ fetch: app.fetch, port: 0 }, (info) => {
      injectWebSocket(server);
      resolve({
        port: info.port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    ws.once('error', reject);
  });
}

describe('ws/broadcast', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ port, close } = await startServer());
  });

  afterAll(() => close());

  test('broadcasts item.created to a connected client', async () => {
    const ws = await connect(port);

    const message = waitForMessage(ws);
    const item = {
      id: '1',
      name: 'Test',
      completed: false,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      projectId: '33333333-3333-4333-8333-333333333333',
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.created', item }, OWNER);

    await expect(message).resolves.toEqual({ type: 'item.created', item });

    ws.close();
  });

  test('broadcasts item.updated and item.deleted', async () => {
    const ws = await connect(port);

    const updated = waitForMessage(ws);
    const item = {
      id: '2',
      name: 'Updated',
      completed: true,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      projectId: '33333333-3333-4333-8333-333333333333',
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.updated', item }, OWNER);
    await expect(updated).resolves.toEqual({ type: 'item.updated', item });

    const deleted = waitForMessage(ws);
    broadcastItemEvent({ type: 'item.deleted', id: '2' }, OWNER);
    await expect(deleted).resolves.toEqual({ type: 'item.deleted', id: '2' });

    ws.close();
  });

  test('broadcasts to every connection of the owner', async () => {
    const [ws1, ws2] = await Promise.all([connect(port), connect(port)]);

    const [m1, m2] = [waitForMessage(ws1), waitForMessage(ws2)];
    const item = {
      id: '3',
      name: 'Multi',
      completed: false,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      projectId: '33333333-3333-4333-8333-333333333333',
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.created', item }, OWNER);

    await expect(m1).resolves.toEqual({ type: 'item.created', item });
    await expect(m2).resolves.toEqual({ type: 'item.created', item });

    ws1.close();
    ws2.close();
  });

  test('does not deliver to other users or unauthenticated sockets', async () => {
    const other = await connect(port, OTHER);
    const received = vi.fn();
    other.on('message', received);

    const anon = new WebSocket(`ws://localhost:${port}/ws`);
    const rejected = new Promise<number>((resolve) =>
      anon.once('unexpected-response', (_req, res) => resolve(res.statusCode!))
    );
    anon.on('error', () => {});
    anon.on('message', received);
    await expect(rejected).resolves.toBe(401);

    const owner = await connect(port);
    const message = waitForMessage(owner);
    broadcastItemEvent({ type: 'item.deleted', id: '6' }, OWNER);
    await message;

    expect(received).not.toHaveBeenCalled();
    other.close();
    owner.close();
  });

  test('skips a client whose readyState is not open', () => {
    const send = vi.fn();
    const stale = new WSContext({ send, close: vi.fn(), readyState: 3 });
    clients.add(stale);
    clientOwners.set(stale, OWNER);

    broadcastItemEvent({ type: 'item.deleted', id: '5' }, OWNER);

    expect(send).not.toHaveBeenCalled();
    clients.delete(stale);
    clientOwners.delete(stale);
  });

  test('stops sending to a client after it disconnects', async () => {
    const ws = await connect(port);
    ws.close();
    await new Promise((r) => setTimeout(r, 50));

    const stillOpen = await connect(port);

    const message = waitForMessage(stillOpen);
    broadcastItemEvent({ type: 'item.deleted', id: '4' }, OWNER);
    await expect(message).resolves.toEqual({ type: 'item.deleted', id: '4' });

    stillOpen.close();
  });
});

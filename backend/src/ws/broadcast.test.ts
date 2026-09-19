import { serve, type ServerType } from '@hono/node-server';
import { WSContext } from 'hono/ws';
import { WebSocket } from 'ws';
import { createRouter } from '@http/app.js';
import { broadcastItemEvent, clients, registerWebSocket } from '@ws/broadcast.js';

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
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(ws);

    const message = waitForMessage(ws);
    const item = {
      id: '1',
      name: 'Test',
      completed: false,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.created', item });

    await expect(message).resolves.toEqual({ type: 'item.created', item });

    ws.close();
  });

  test('broadcasts item.updated and item.deleted', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(ws);

    const updated = waitForMessage(ws);
    const item = {
      id: '2',
      name: 'Updated',
      completed: true,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.updated', item });
    await expect(updated).resolves.toEqual({ type: 'item.updated', item });

    const deleted = waitForMessage(ws);
    broadcastItemEvent({ type: 'item.deleted', id: '2' });
    await expect(deleted).resolves.toEqual({ type: 'item.deleted', id: '2' });

    ws.close();
  });

  test('broadcasts to every connected client', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    const [m1, m2] = [waitForMessage(ws1), waitForMessage(ws2)];
    const item = {
      id: '3',
      name: 'Multi',
      completed: false,
      priority: 'medium' as const,
      description: null,
      dueDate: null,
      overdue: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    broadcastItemEvent({ type: 'item.created', item });

    await expect(m1).resolves.toEqual({ type: 'item.created', item });
    await expect(m2).resolves.toEqual({ type: 'item.created', item });

    ws1.close();
    ws2.close();
  });

  test('skips a client whose readyState is not open', () => {
    const send = vi.fn();
    const stale = new WSContext({ send, close: vi.fn(), readyState: 3 });
    clients.add(stale);

    broadcastItemEvent({ type: 'item.deleted', id: '5' });

    expect(send).not.toHaveBeenCalled();
    clients.delete(stale);
  });

  test('stops sending to a client after it disconnects', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(ws);
    ws.close();
    await new Promise((r) => setTimeout(r, 50));

    const stillOpen = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(stillOpen);

    const message = waitForMessage(stillOpen);
    broadcastItemEvent({ type: 'item.deleted', id: '4' });
    await expect(message).resolves.toEqual({ type: 'item.deleted', id: '4' });

    stillOpen.close();
  });
});

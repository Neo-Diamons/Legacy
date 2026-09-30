import { serve, type ServerType } from '@hono/node-server';
import { WSContext } from 'hono/ws';
import { WebSocket } from 'ws';
import { userService } from '@service/user.service.js';
import { broadcastItemEvent, clientOwners, clients, disconnectUser } from '@ws/broadcast.js';
import { resetDb } from '../test/db.js';
import { PASSWORD, call, injectWebSocket, issueToken, json, seedProject, seedUser, app } from '../test/fixtures.js';

type Session = Awaited<ReturnType<typeof seedUser>>;
type Message = { type: string; item?: { id: string; name: string }; id?: string };

let server: ServerType;
let port: number;
let alice: Session;
let bob: Session;
let project: string;
const sockets: WebSocket[] = [];

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      port = info.port;
      resolve();
    });
    injectWebSocket(server);
  });
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(async () => {
  await resetDb();
  alice = await seedUser('alice@example.com', { password: PASSWORD });
  bob = await seedUser('bob@example.com');
  project = await seedProject(alice.id);
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await vi.waitFor(() => expect(clients.size).toBe(0));
});

/** Trades a JWT for a single-use WebSocket ticket. */
async function mintTicket(token: string) {
  const res = await app.request('/ws/ticket', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, ticket: res.status === 200 ? (await json<{ ticket: string }>(res)).ticket : '' };
}

/** Opens a socket with a fresh ticket and records every message it receives. */
async function connect(token: string) {
  const ws = new WebSocket(`ws://localhost:${port}/ws?ticket=${(await mintTicket(token)).ticket}`);
  sockets.push(ws);
  const messages: Message[] = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return { ws, messages };
}

/** Status code of the HTTP answer when the upgrade is refused. */
function rejection(url: string) {
  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(url);
    sockets.push(ws);
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode!));
    ws.on('open', () => reject(new Error('the upgrade was accepted')));
    ws.on('error', () => {});
  });
}

const closeCode = (ws: WebSocket) => new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('handshake', () => {
  it('accepts a valid ticket and registers the socket for its owner', async () => {
    await connect(alice.token);

    expect(clients.size).toBe(1);
    expect([...clientOwners.values()]).toEqual([alice.id]);
  });

  it('refuses a connection without a ticket', async () => {
    expect(await rejection(`ws://localhost:${port}/ws`)).toBe(401);
    expect(clients.size).toBe(0);
  });

  it('refuses an empty or unknown ticket', async () => {
    expect(await rejection(`ws://localhost:${port}/ws?ticket=`)).toBe(401);
    expect(await rejection(`ws://localhost:${port}/ws?ticket=garbage`)).toBe(401);
  });

  it('no longer accepts a JWT in the query string', async () => {
    expect(await rejection(`ws://localhost:${port}/ws?token=${alice.token}`)).toBe(401);
    expect(await rejection(`ws://localhost:${port}/ws?ticket=${alice.token}`)).toBe(401);
  });

  it('does not read credentials from the Authorization header', async () => {
    const status = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: alice.headers });
      sockets.push(ws);
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode!));
      ws.on('error', () => {});
    });
    expect(status).toBe(401);
  });

  it('only issues tickets to authenticated users', async () => {
    expect((await mintTicket('garbage')).status).toBe(401);
    expect((await mintTicket(await issueToken(alice.id, 0, -10))).status).toBe(401);
    const forged = await issueToken(alice.id, 0, 3600, 'a-different-secret-of-32-characters!!');
    expect((await mintTicket(forged)).status).toBe(401);
    expect((await call(null, 'POST', '/ws/ticket')).status).toBe(401);
  });

  it('refuses to issue a ticket for a revoked token', async () => {
    await call(alice, 'PUT', `/users/${alice.id}`, { password: 'a-brand-new-password' });
    expect((await mintTicket(alice.token)).status).toBe(401);
  });

  it('refuses a ticket that was already used', async () => {
    const { ticket } = await mintTicket(alice.token);
    const ws = new WebSocket(`ws://localhost:${port}/ws?ticket=${ticket}`);
    sockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    expect(await rejection(`ws://localhost:${port}/ws?ticket=${ticket}`)).toBe(401);
  });

  it('refuses an expired ticket', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { ticket } = await mintTicket(alice.token);
      vi.setSystemTime(Date.now() + 31_000);
      expect(await rejection(`ws://localhost:${port}/ws?ticket=${ticket}`)).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses a ticket whose session was revoked after issue', async () => {
    const { ticket } = await mintTicket(alice.token);
    await call(alice, 'PUT', `/users/${alice.id}`, { password: 'a-brand-new-password' });
    expect(await rejection(`ws://localhost:${port}/ws?ticket=${ticket}`)).toBe(401);
  });

  it('refuses a ticket of a deleted user', async () => {
    const { ticket } = await mintTicket(alice.token);
    await userService.deleteUser(alice.id);
    expect(await rejection(`ws://localhost:${port}/ws?ticket=${ticket}`)).toBe(401);
  });

  it('never registers a refused socket', async () => {
    await rejection(`ws://localhost:${port}/ws?ticket=garbage`);
    expect(clients.size).toBe(0);
    expect(clientOwners.size).toBe(0);
  });

  it('forgets a socket when it closes', async () => {
    const { ws } = await connect(alice.token);
    ws.close();

    await vi.waitFor(() => expect(clients.size).toBe(0));
    expect(clientOwners.size).toBe(0);
  });
});

describe('item events from the REST API', () => {
  it('sends item.created to the owner with the item as answered by the API', async () => {
    const { messages } = await connect(alice.token);

    const created = await json(await call(alice, 'POST', '/items', { name: 'Buy milk', projectId: project }));

    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toEqual({ type: 'item.created', item: created });
  });

  it('sends item.updated with the updated item', async () => {
    const created = await json(await call(alice, 'POST', '/items', { name: 'Old', projectId: project }));
    const { messages } = await connect(alice.token);

    const updated = await json(await call(alice, 'PUT', `/items/${created.id}`, { name: 'New', completed: true }));

    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toEqual({ type: 'item.updated', item: updated });
    expect(messages[0].item).toMatchObject({ name: 'New', completed: true });
  });

  it('sends item.deleted with only the id', async () => {
    const created = await json(await call(alice, 'POST', '/items', { name: 'x', projectId: project }));
    const { messages } = await connect(alice.token);

    await call(alice, 'DELETE', `/items/${created.id}`);

    await vi.waitFor(() => expect(messages).toHaveLength(1));
    expect(messages[0]).toEqual({ type: 'item.deleted', id: created.id });
  });

  it('delivers events in the order they happened', async () => {
    const { messages } = await connect(alice.token);

    const created = await json(await call(alice, 'POST', '/items', { name: 'x', projectId: project }));
    await call(alice, 'PUT', `/items/${created.id}`, { name: 'y', completed: false });
    await call(alice, 'DELETE', `/items/${created.id}`);

    await vi.waitFor(() => expect(messages).toHaveLength(3));
    expect(messages.map((m) => m.type)).toEqual(['item.created', 'item.updated', 'item.deleted']);
  });

  it('reaches every open connection of the owner', async () => {
    const [first, second] = [await connect(alice.token), await connect(alice.token)];

    await call(alice, 'POST', '/items', { name: 'x', projectId: project });

    await vi.waitFor(() => {
      expect(first.messages).toHaveLength(1);
      expect(second.messages).toHaveLength(1);
    });
  });

  it('never reaches another user', async () => {
    const mine = await connect(alice.token);
    const theirs = await connect(bob.token);

    await call(alice, 'POST', '/items', { name: 'private', projectId: project });
    await vi.waitFor(() => expect(mine.messages).toHaveLength(1));
    await settle();

    expect(theirs.messages).toEqual([]);
  });

  it('does not broadcast when the request fails', async () => {
    const created = await json(await call(alice, 'POST', '/items', { name: 'x', projectId: project }));
    const { messages } = await connect(alice.token);

    await call(alice, 'POST', '/items', { name: '', projectId: crypto.randomUUID() });
    await call(alice, 'POST', '/items', { projectId: project });
    await call(alice, 'PUT', `/items/${crypto.randomUUID()}`, { name: 'x', completed: false });
    await call(alice, 'PUT', `/items/${created.id}`, { name: 'x' });
    await call(alice, 'DELETE', `/items/${crypto.randomUUID()}`);
    await call(bob, 'DELETE', `/items/${created.id}`);
    await settle();

    expect(messages).toEqual([]);
  });

  it('does not tell anyone about an item another user tried to change', async () => {
    const created = await json(await call(alice, 'POST', '/items', { name: 'x', projectId: project }));
    const owner = await connect(alice.token);
    const intruder = await connect(bob.token);

    await call(bob, 'PUT', `/items/${created.id}`, { name: 'hacked', completed: true });
    await settle();

    expect(owner.messages).toEqual([]);
    expect(intruder.messages).toEqual([]);
  });
});

describe('session revocation', () => {
  it('closes the sockets of a user who changes their password', async () => {
    const { ws } = await connect(alice.token);
    const bobSocket = await connect(bob.token);
    const closed = closeCode(ws);

    await call(alice, 'PUT', `/users/${alice.id}`, { password: 'a-brand-new-password' });

    expect(await closed).toBe(1008);
    expect(clients.size).toBe(1);
    expect(bobSocket.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('closes the sockets of a user who deletes their account', async () => {
    const { ws } = await connect(alice.token);
    const closed = closeCode(ws);

    await call(alice, 'DELETE', `/users/${alice.id}`);

    expect(await closed).toBe(1008);
    expect(clients.size).toBe(0);
  });

  it('keeps the sockets open when only the name changes', async () => {
    const { ws } = await connect(alice.token);

    await call(alice, 'PUT', `/users/${alice.id}`, { name: 'Renamed' });
    await settle();

    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('disconnectUser closes every socket of that user and nobody else', async () => {
    const [a1, a2, b] = [await connect(alice.token), await connect(alice.token), await connect(bob.token)];
    const closed = [closeCode(a1.ws), closeCode(a2.ws)];

    disconnectUser(alice.id);

    expect(await Promise.all(closed)).toEqual([1008, 1008]);
    expect(b.ws.readyState).toBe(WebSocket.OPEN);
    expect([...clientOwners.values()]).toEqual([bob.id]);
  });

  it('disconnectUser does nothing for a user without sockets', async () => {
    const { ws } = await connect(alice.token);
    disconnectUser(crypto.randomUUID());
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
});

describe('broadcastItemEvent', () => {
  const event = { type: 'item.deleted', id: 'abc' } as const;

  const fakes: WSContext[] = [];
  const fakeClient = (readyState: 0 | 1 | 2 | 3, owner?: string) => {
    const send = vi.fn();
    const client = new WSContext({ send, close: vi.fn(), readyState });
    clients.add(client);
    fakes.push(client);
    if (owner) clientOwners.set(client, owner);
    return { client, send };
  };

  afterEach(() => {
    for (const client of fakes.splice(0)) {
      clients.delete(client);
      clientOwners.delete(client);
    }
  });

  it('sends the JSON encoded event to the sockets of the owner', () => {
    const { send } = fakeClient(1, alice.id);

    broadcastItemEvent(event, alice.id);

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual(event);
  });

  it('skips sockets of other owners', () => {
    const { send } = fakeClient(1, bob.id);
    broadcastItemEvent(event, alice.id);
    expect(send).not.toHaveBeenCalled();
  });

  it('skips sockets that have no owner', () => {
    const { send } = fakeClient(1);
    broadcastItemEvent(event, alice.id);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([0, 2, 3] as const)('skips a socket whose readyState is %i (not open)', (readyState) => {
    const { send } = fakeClient(readyState, alice.id);
    broadcastItemEvent(event, alice.id);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not throw when nobody is connected', () => {
    expect(() => broadcastItemEvent(event, alice.id)).not.toThrow();
  });
});

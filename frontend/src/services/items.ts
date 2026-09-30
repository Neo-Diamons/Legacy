import type { TaskPriority } from '../types';
import { authFetch, expireAuthSession, getAuthToken, isRefreshingSession } from './authClient';

export interface ItemResponse {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  priority: TaskPriority;
  dueDate: string | null;
  overdue: boolean;
  createdAt: string;
  projectId?: string | null;
}

export type ItemEvent =
  | { type: 'item.created'; item: ItemResponse }
  | { type: 'item.updated'; item: ItemResponse }
  | { type: 'item.deleted'; id: string };

export interface ItemInput {
  name: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  projectId?: string | null;
}

async function parseOrThrow<T>(res: Response): Promise<{ status: number; data: T }> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { status: res.status, data: (await res.json()) as T };
}

export function fetchItems(): Promise<ItemResponse[]> {
  return authFetch('/items')
    .then((res) => parseOrThrow<ItemResponse[]>(res))
    .then(({ data }) => data);
}

function toApiDueDate(dueDate: string | null | undefined): string | null | undefined {
  if (!dueDate) return dueDate;

  if (dueDate.includes('T')) {
    return new Date(dueDate).toISOString();
  }

  return `${dueDate}T00:00:00.000Z`;
}

export function toDateInputValue(dueDate: string | null): string {
  return dueDate ? dueDate.slice(0, 10) : '';
}

export function createItem(input: ItemInput): Promise<{ status: number; item: ItemResponse }> {
  return authFetch('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      dueDate: toApiDueDate(input.dueDate),
    }),
  }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json().then((item) => ({ status: res.status, item }));
  });
}

export function updateItem(
  id: string,
  input: ItemInput & { completed: boolean }
): Promise<{ status: number; item: ItemResponse }> {
  return authFetch(`/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      dueDate: toApiDueDate(input.dueDate),
    }),
  }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json().then((item) => ({ status: res.status, item }));
  });
}

export function deleteItem(id: string): Promise<number> {
  return authFetch(`/items/${id}`, { method: 'DELETE' }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.status;
  });
}

export function openItemSocket(onEvent: (event: ItemEvent) => void): () => void {
  let socket: WebSocket | undefined;
  let cancelled = false;

  // Browsers cannot set headers on a WebSocket handshake, so trade the JWT for a single-use ticket
  // instead of putting the JWT itself in the URL (where it would end up in access logs).
  void (async () => {
    const response = await authFetch('/ws/ticket', { method: 'POST' });
    if (!response.ok || cancelled) return;
    const { ticket } = (await response.json()) as { ticket: string };
    const tokenAtOpen = getAuthToken();
    if (cancelled) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`);
    socket.addEventListener('close', (event) => {
      // The backend closes with 1008 when the session was revoked, unless this very session was just replaced
      // (password change): then the socket is reopened with the new token.
      if ((event as CloseEvent).code !== 1008) return;
      if (isRefreshingSession() || getAuthToken() !== tokenAtOpen) return;
      expireAuthSession();
    });
    socket.addEventListener('message', (message) => {
      onEvent(JSON.parse(message.data) as ItemEvent);
    });
  })().catch(() => {});

  return () => {
    cancelled = true;
    if (!socket) return;
    // Closing while CONNECTING (e.g. StrictMode double mount) logs a browser warning; wait for open.
    if (socket.readyState === WebSocket.CONNECTING) {
      const pending = socket;
      pending.addEventListener('open', () => pending.close());
    } else {
      socket.close();
    }
  };
}

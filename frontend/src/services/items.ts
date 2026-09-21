import type { TaskPriority } from '../types';

export interface ItemResponse {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  priority: TaskPriority;
  dueDate: string | null;
  overdue: boolean;
  createdAt: string;
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
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchItems(): Promise<ItemResponse[]> {
  return fetch('/items').then((res) => parseOrThrow<ItemResponse[]>(res));
}

export function createItem(input: ItemInput): Promise<ItemResponse> {
  return fetch('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((res) => parseOrThrow<ItemResponse>(res));
}

export function updateItem(id: string, input: ItemInput & { completed: boolean }): Promise<ItemResponse> {
  return fetch(`/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((res) => parseOrThrow<ItemResponse>(res));
}

export function deleteItem(id: string): Promise<void> {
  return fetch(`/items/${id}`, { method: 'DELETE' }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  });
}

export function openItemSocket(onEvent: (event: ItemEvent) => void): () => void {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener('message', (message) => {
    onEvent(JSON.parse(message.data) as ItemEvent);
  });
  return () => socket.close();
}

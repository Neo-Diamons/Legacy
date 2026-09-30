/* eslint-disable react-refresh/only-export-components -- test helpers, not a hot-reloaded module */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import App from '../App';
import { useAppData } from '../context/appDataContext';
import type { ItemEvent, ItemResponse } from '../services/items';

export const item = (id: string, name: string, overrides: Partial<ItemResponse> = {}): ItemResponse => ({
  id,
  name,
  description: null,
  completed: false,
  priority: 'medium',
  dueDate: null,
  overdue: false,
  createdAt: '2026-01-14T00:00:00.000Z',
  ...overrides,
});

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  closed = false;
  readyState = MockWebSocket.OPEN;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener() {}

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners[type] ?? []) listener({ data: JSON.stringify(data) });
  }
}

export const latestSocket = (): MockWebSocket => {
  const socket = MockWebSocket.instances.at(-1);
  if (!socket) throw new Error('no WebSocket was opened');
  return socket;
};

/** Simulates the backend broadcasting an item event to this tab. */
export const emitEvent = (event: ItemEvent) => {
  act(() => latestSocket().emit('message', event));
};

export const jsonResponse = (body: unknown, { status = 200, statusText = 'OK' } = {}) => ({
  ok: true,
  status,
  statusText,
  json: () => Promise.resolve(body),
});

export const errorResponse = (status: number, statusText: string) => ({
  ok: false,
  status,
  statusText,
  json: () => Promise.reject(new Error('error responses have no JSON body')),
});

type Handler = (url: string, init?: RequestInit) => unknown;

/** Stubs `fetch`. A handler that throws or returns a rejected value simulates a network failure. */
export function stubFetch(handler: Handler) {
  const fn = vi.fn((url: string, init?: RequestInit) => new Promise((resolve) => resolve(handler(String(url), init))));
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Serves `GET /items` with `items`; `override` may answer any request first (return undefined to fall through). */
export function stubApi(items: ItemResponse[], override: Handler = () => undefined) {
  return stubFetch((url, init) => {
    const answer = override(url, init);
    if (answer !== undefined) return answer;
    if (url === '/items' && !init?.method) return jsonResponse(items);
    throw new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });
}

export const callsWith = (fetchMock: ReturnType<typeof stubFetch>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

export const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Waits for `text`, then flushes passive effects so the provider's refs reflect what is on screen. */
export async function findSettled(text: string | RegExp) {
  const found = await screen.findByText(text);
  await act(async () => undefined);
  return found;
}

/** Project deletion is disabled in the UI, so tests reach the "no project" states through this button. */
export function DeleteSeedProject() {
  const { deleteProject } = useAppData();
  return <button onClick={() => deleteProject('p-1')}>delete seed project</button>;
}

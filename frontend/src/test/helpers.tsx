/* eslint-disable react-refresh/only-export-components -- test helpers, not a hot-reloaded module */
import { act, render, screen, waitFor } from '@testing-library/react';
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
  projectId: 'p-1',
  dueDate: null,
  overdue: false,
  createdAt: '2026-01-14T00:00:00.000Z',
  ...overrides,
});

export const TOKEN_KEY = 'legacy.auth.token';
export const USER_KEY = 'legacy.auth.user';

export const USER = {
  id: 'u-1',
  name: 'Michel Dupont',
  email: 'michel.dupont@example.com',
  createdAt: '2026-01-14T00:00:00.000Z',
};

export const PROJECT = { id: 'p-1', name: 'Mon projet', color: '#4f8ef7', createdAt: '2026-01-14T00:00:00.000Z' };

// A JWT-shaped token: the client only reads the `exp` claim to drop expired sessions.
export const validToken = () =>
  `header.${btoa(JSON.stringify({ sub: USER.id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;

export const signIn = () => {
  localStorage.setItem(TOKEN_KEY, validToken());
  localStorage.setItem(USER_KEY, JSON.stringify(USER));
};

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

/** The socket opens only after the `/ws/ticket` round trip, so wait for it. */
export const findSocket = () => waitFor(latestSocket);

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

/**
 * Stubs `fetch`. A handler that throws or returns a rejected value simulates a network failure.
 * `POST /ws/ticket` is answered here and never reaches the handler or the returned mock, so call assertions only see API traffic.
 */
export function stubFetch(handler: Handler) {
  const fn = vi.fn((url: string, init?: RequestInit) => new Promise((resolve) => resolve(handler(String(url), init))));
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url) === '/ws/ticket' && init?.method === 'POST'
      ? Promise.resolve(jsonResponse({ ticket: 'test-ticket' }))
      : fn(url, init)
  );
  return fn;
}

/** Holds every request until `release()`, then answers with `items` and the seed project. */
export function stubPendingApi(items: ItemResponse[] = []) {
  const waiting: (() => void)[] = [];
  stubFetch(
    (url) =>
      new Promise((resolve) => waiting.push(() => resolve(jsonResponse(url === '/projects' ? [PROJECT] : items))))
  );
  return { release: () => waiting.forEach((answer) => answer()) };
}

let createdProjects = 1;

/** Serves `GET /items` with `items` and `GET /projects` with the seed project, and answers project creation and deletion; `override` may answer any request first (return undefined to fall through). */
export function stubApi(items: ItemResponse[], override: Handler = () => undefined) {
  return stubFetch((url, init) => {
    const answer = override(url, init);
    if (answer !== undefined) return answer;
    if (url === '/items' && !init?.method) return jsonResponse(items);
    if (url === '/projects' && !init?.method) return jsonResponse([PROJECT]);
    if (url === '/projects' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; color: string };
      return jsonResponse(
        { ...PROJECT, ...body, id: `p-${++createdProjects}` },
        { status: 201, statusText: 'Created' }
      );
    }
    if (url.startsWith('/projects/') && init?.method === 'DELETE') {
      return { ok: true, status: 204, statusText: 'No Content' };
    }
    throw new Error(`unexpected request: ${init?.method ?? 'GET'} ${url}`);
  });
}

export const callsWith = (fetchMock: ReturnType<typeof stubFetch>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

export const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

/** Renders the app signed in, unless `signedIn` is false. */
export function renderApp(route = '/', { signedIn = true } = {}) {
  if (signedIn) signIn();
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

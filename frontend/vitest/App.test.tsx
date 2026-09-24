import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import App from '../src/App';
import type { ItemResponse } from '../src/services/items';

const item = (id: string, name: string, completed = false): ItemResponse => ({
  id,
  name,
  description: null,
  completed,
  priority: 'medium',
  dueDate: null,
  overdue: false,
  createdAt: '2026-01-14T00:00:00.000Z',
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};

  constructor() {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener() {}

  close() {}

  emit(type: string, data: unknown) {
    for (const listener of this.listeners[type] ?? []) listener({ data: JSON.stringify(data) });
  }
}

const openProject = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
  fireEvent.click(screen.getByText('Mon projet').closest('.project-card') as HTMLElement);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  MockWebSocket.instances = [];
});

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  test('shows a loading state then the empty task list', async () => {
    let resolveItems: (items: unknown[]) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveItems = (items) => resolve({ ok: true, json: () => Promise.resolve(items) });
          })
      )
    );

    const { container } = render(<App />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    resolveItems([]);

    expect(await screen.findByText('Bonjour Michel 👋')).toBeInTheDocument();
    expect(screen.getByText('Aucune tâche en cours. 🎉')).toBeInTheDocument();
  });

  test('adds a task through the create-task modal', async () => {
    const createdItem = item('1', 'Write tests');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(createdItem) });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une tâche' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: createdItem.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: createdItem.name, priority: 'medium', dueDate: null }),
      })
    );

    expect(await screen.findByText(createdItem.name)).toBeInTheDocument();
  });

  test('toggles completion and removes a task from the project view', async () => {
    const firstItem = item('1', 'First item');
    const secondItem = item('2', 'Second item', true);
    const updatedItem = item('1', 'First item', true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([firstItem, secondItem]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedItem) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    expect(await screen.findByText(firstItem.name)).toBeInTheDocument();
    expect(screen.getByText(secondItem.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Marquer comme terminée' }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/items/${firstItem.id}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: firstItem.name,
          completed: true,
          description: firstItem.description,
          priority: firstItem.priority,
          dueDate: firstItem.dueDate,
        }),
      })
    );

    expect(await screen.findByRole('checkbox', { name: 'Marquer comme non terminée' })).toBeInTheDocument();

    const firstRow = screen.getByText(firstItem.name).closest('.task-row') as HTMLElement;
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Supprimer la tâche' }));

    expect(fetchMock).toHaveBeenNthCalledWith(3, `/items/${updatedItem.id}`, { method: 'DELETE' });

    await waitFor(() => expect(screen.queryByText(firstItem.name)).not.toBeInTheDocument());
    expect(screen.getByText(secondItem.name)).toBeInTheDocument();
  });

  test('shows notification on task toggle error', async () => {
    const firstItem = item('1', 'First item not found');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([firstItem]) })
      .mockRejectedValueOnce(new Error('404 Not found'));  // ← simulate error
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    fireEvent.click(screen.getByRole('checkbox'));

    // vérifie que la notif est là
    expect(await screen.findByText(/404.*Not found/)).toBeInTheDocument();
  });

  test('shows notification on task toggle error', async () => {
    const firstItem = item('1', 'First item error internal');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([firstItem]) })
      .mockRejectedValueOnce(new Error('502 bad access'));  // ← simulate error
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    fireEvent.click(screen.getByRole('checkbox'));

    // vérifie que la notif est là
    expect(await screen.findByText(/502.*bad access/)).toBeInTheDocument();
  });

  test('shows notification on task toggle error', async () => {
    const firstItem = item('2', 'second item error format test');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([firstItem]) })
      .mockRejectedValueOnce(new Error('422 unprocessed format'));  // ← simulate error
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    fireEvent.click(screen.getByRole('checkbox'));

    // vérifie que la notif est là
    expect(await screen.findByText(/422.*unprocessed format/)).toBeInTheDocument();
  });

  test('reflects item.created/updated/deleted events pushed over the websocket', async () => {
    const pushedItem = item('1', 'Pushed item');
    const updatedItem = item('1', 'Pushed item', true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));

    render(<App />);
    await screen.findByText('Bonjour Michel 👋');
    openProject();

    const [socket] = MockWebSocket.instances;

    socket.emit('message', { type: 'item.created', item: pushedItem });
    expect(await screen.findByText(pushedItem.name)).toBeInTheDocument();

    socket.emit('message', { type: 'item.updated', item: updatedItem });
    expect(await screen.findByRole('checkbox', { name: 'Marquer comme non terminée' })).toBeInTheDocument();

    socket.emit('message', { type: 'item.deleted', id: updatedItem.id });
    await waitFor(() => expect(screen.queryByText(updatedItem.name)).not.toBeInTheDocument());
  });
});

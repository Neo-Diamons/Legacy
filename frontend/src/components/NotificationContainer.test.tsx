import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { emitEvent, errorResponse, item, renderApp, stubApi, stubFetch, jsonResponse } from '../test/helpers';

const iconOf = (message: string) => screen.getByText(message).parentElement!.querySelector('i')!;

describe('notifications driven by websocket events', () => {
  test.each([
    ['item.created', { type: 'item.created', item: item('1', 'A') }, 'Task created!'],
    [
      'item.updated (completed)',
      { type: 'item.updated', item: item('1', 'A', { completed: true }) },
      'Task completed!',
    ],
    [
      'item.updated (other change)',
      { type: 'item.updated', item: item('1', 'A', { priority: 'high' }) },
      'Task updated!',
    ],
    ['item.deleted', { type: 'item.deleted', id: '1' }, 'Task deleted!'],
  ] as const)('%s shows "%s"', async (_name, event, message) => {
    stubApi([item('1', 'A')]);
    renderApp();
    await screen.findByText('A');

    emitEvent(event);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(iconOf(message)).toHaveClass('fa-check-circle');
  });

  test('reopening a completed task shows "Task uncompleted!"', async () => {
    stubApi([item('1', 'A', { completed: true })]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    emitEvent({ type: 'item.updated', item: item('1', 'A') });

    expect(screen.getByText('Task uncompleted!')).toBeInTheDocument();
  });

  test('every open tab is notified, including for changes it did not make', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    emitEvent({ type: 'item.created', item: item('7', 'Made in another tab') });

    expect(screen.getByText('Task created!')).toBeInTheDocument();
  });

  test('the acting tab does not notify twice: a successful POST alone shows nothing', async () => {
    stubApi([], (_url, init) => (init?.method === 'POST' ? jsonResponse(item('9', 'Mine')) : undefined));
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une tâche' }));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));
    await screen.findByText('Mine');

    expect(screen.queryByText('Task created!')).not.toBeInTheDocument();
  });

  test('simultaneous events stack as separate toasts', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    emitEvent({ type: 'item.created', item: item('1', 'A') });
    emitEvent({ type: 'item.created', item: item('2', 'B') });
    emitEvent({ type: 'item.deleted', id: '1' });

    expect(screen.getAllByText('Task created!')).toHaveLength(2);
    expect(screen.getByText('Task deleted!')).toBeInTheDocument();
  });

  test('a toast disappears by itself after 2 seconds, and only then', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    vi.useFakeTimers();
    emitEvent({ type: 'item.created', item: item('1', 'A') });
    expect(screen.getByText('Task created!')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1999));
    expect(screen.getByText('Task created!')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByText('Task created!')).not.toBeInTheDocument();
  });

  test('each toast has its own timer: an older toast expiring keeps the newer one', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    vi.useFakeTimers();
    emitEvent({ type: 'item.created', item: item('1', 'A') });
    act(() => void vi.advanceTimersByTime(1500));
    emitEvent({ type: 'item.deleted', id: '1' });

    act(() => void vi.advanceTimersByTime(600)); // first toast is 2100ms old, second 600ms
    expect(screen.queryByText('Task created!')).not.toBeInTheDocument();
    expect(screen.getByText('Task deleted!')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1400));
    expect(screen.queryByText('Task deleted!')).not.toBeInTheDocument();
  });

  test('clicking a toast dismisses it immediately, leaving the others', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');
    emitEvent({ type: 'item.created', item: item('1', 'A') });
    emitEvent({ type: 'item.deleted', id: '1' });

    fireEvent.click(screen.getByText('Task created!'));

    expect(screen.queryByText('Task created!')).not.toBeInTheDocument();
    expect(screen.getByText('Task deleted!')).toBeInTheDocument();
  });

  test('the container is pinned to the corner so it never pushes content', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');
    emitEvent({ type: 'item.created', item: item('1', 'A') });

    const container = screen.getByText('Task created!').parentElement!.parentElement!;
    expect(container).toHaveStyle({ position: 'fixed', top: '16px', right: '16px' });
  });
});

describe('notifications driven by API errors', () => {
  test.each([
    [404, 'Not Found', 'fa-exclamation-triangle'],
    [422, 'Unprocessable Entity', 'fa-exclamation-triangle'],
    [500, 'Internal Server Error', 'fa-times-circle'],
    [502, 'Bad Gateway', 'fa-times-circle'],
  ])('HTTP %i shows "%s" with the %s icon', async (status, statusText, icon) => {
    stubFetch(() => errorResponse(status, statusText));
    renderApp();

    expect(await screen.findByText(statusText)).toBeInTheDocument();
    expect(iconOf(statusText)).toHaveClass(icon);
  });

  test('a status without a dedicated style still shows a neutral info toast', async () => {
    stubFetch(() => errorResponse(418, "I'm a teapot"));
    renderApp();

    expect(await screen.findByText("I'm a teapot")).toBeInTheDocument();
    expect(iconOf("I'm a teapot")).toHaveClass('fa-info-circle');
  });

  test('the HTTP status code is never shown to the user, only the reason', async () => {
    stubFetch(() => errorResponse(404, 'Not Found'));
    renderApp();
    await screen.findByText('Not Found');
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
  });

  test('an error without a numeric status is styled as a server error (500)', async () => {
    stubFetch(() => Promise.reject(new Error('Connection refused')));
    renderApp();

    await screen.findByText('Bonjour Michel 👋');
    expect(document.querySelector('i.fa-times-circle')).toBeInTheDocument();
    expect(document.querySelector('i.fa-info-circle')).not.toBeInTheDocument();
  });

  // Known bug: formatPopUpAndAddNotification always drops the first word, so plain
  // network errors ("Failed to fetch") are shown truncated ("to fetch").
  test.fails('a network error keeps its full message', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    renderApp();
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });
});

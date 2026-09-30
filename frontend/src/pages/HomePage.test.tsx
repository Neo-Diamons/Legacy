import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { AppDataProvider } from '../context/AppDataProvider';
import { AuthProvider } from '../services/auth';
import { HomePage } from './HomePage';
import {
  DeleteSeedProject,
  emitEvent,
  findSettled,
  errorResponse,
  item,
  jsonResponse,
  renderApp,
  signIn,
  stubApi,
  stubFetch,
  stubPendingApi,
} from '../test/helpers';

const shownTitles = () => Array.from(document.querySelectorAll('.task-row-title')).map((el) => el.textContent);

describe('home page', () => {
  test('shows a busy skeleton until items load, then the greeting', async () => {
    const api = stubPendingApi();
    const { container } = renderApp();

    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
    expect(screen.queryByText(/Bonjour/)).not.toBeInTheDocument();

    api.release();
    expect(await screen.findByText('Bonjour Michel 👋')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  test('greets with the first name only', async () => {
    stubApi([]);
    renderApp();
    expect((await screen.findByText(/Bonjour/)).tagName).toBe('H1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bonjour Michel 👋');
    expect(screen.queryByText(/Dupont/)).not.toBeInTheDocument();
  });

  test('shows the empty state when there is nothing to do', async () => {
    stubApi([]);
    renderApp();
    expect(await screen.findByText('Aucune tâche en cours. 🎉')).toBeInTheDocument();
  });

  test('a failed initial load still ends the loading state and reports the error', async () => {
    stubFetch(() => errorResponse(500, 'Internal Server Error'));
    const { container } = renderApp();

    expect(await screen.findByText('Internal Server Error')).toBeInTheDocument();
    expect(await screen.findByText('Bonjour Michel 👋')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    // No project could be loaded either, so the user is pointed to the Projects tab rather than told all is done.
    expect(screen.getByText(/Vous n'avez pas encore de projet/)).toBeInTheDocument();
  });

  test('lists upcoming tasks by due date, undated last, completed hidden', async () => {
    stubApi([
      item('1', 'Later', { dueDate: '2026-03-02T12:00:00.000Z' }),
      item('2', 'No date'),
      item('3', 'Soonest', { dueDate: '2026-01-05T12:00:00.000Z' }),
      item('4', 'Done already', { dueDate: '2026-01-01T12:00:00.000Z', completed: true }),
    ]);
    renderApp();
    await screen.findByText('Soonest');

    expect(shownTitles()).toEqual(['Soonest', 'Later', 'No date']);
    expect(screen.queryByText('Done already')).not.toBeInTheDocument();
  });

  test('caps the task widget at 6 tasks and keeps the earliest ones', async () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      item(String(i), `Task ${i}`, { dueDate: `2026-02-${String(20 - i).padStart(2, '0')}T12:00:00.000Z` })
    );
    stubApi(items);
    renderApp();
    await screen.findByText('Task 7');

    // Earliest due date first: Task 7 (Feb 13) ... Task 2 (Feb 18).
    expect(shownTitles()).toEqual(['Task 7', 'Task 6', 'Task 5', 'Task 4', 'Task 3', 'Task 2']);
  });

  test('a task row shows priority, project and due date', async () => {
    stubApi([item('1', 'Ship it', { priority: 'urgent', dueDate: '2026-03-02T12:00:00.000Z' })]);
    renderApp();
    const row = (await screen.findByText('Ship it')).closest('.task-row') as HTMLElement;

    expect(within(row).getByText('Urgente')).toBeInTheDocument();
    expect(within(row).getByText('Mon projet')).toBeInTheDocument();
    expect(within(row).getByText('Échéance 2 mars')).toBeInTheDocument();
  });

  test('a task without a due date says so', async () => {
    stubApi([item('1', 'Someday')]);
    renderApp();
    const row = (await screen.findByText('Someday')).closest('.task-row') as HTMLElement;
    expect(within(row).getByText('Sans échéance')).toBeInTheDocument();
  });

  test.each([
    ['low', 'Basse'],
    ['medium', 'Moyenne'],
    ['high', 'Haute'],
    ['urgent', 'Urgente'],
  ] as const)('%s priority renders as "%s"', async (priority, label) => {
    stubApi([item('1', 'Prioritised', { priority })]);
    renderApp();
    const row = (await screen.findByText('Prioritised')).closest('.task-row') as HTMLElement;
    expect(within(row).getByText(label)).toBeInTheDocument();
  });

  test('project card reports progress, and "Aucune tâche" when empty', async () => {
    stubApi([]);
    renderApp();
    const card = await screen.findByRole('button', { name: /Mon projet/ });
    expect(within(card).getByText('Aucune tâche')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    emitEvent({ type: 'item.created', item: item('1', 'A') });
    emitEvent({ type: 'item.created', item: item('2', 'B') });
    emitEvent({ type: 'item.updated', item: item('2', 'B', { completed: true }) });

    expect(within(card).getByText('1/2 tâches terminées')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  test('ticking a task on the home page completes it and drops it from the list', async () => {
    const fetchMock = stubApi([item('1', 'Tick me'), item('2', 'Keep me')], (url, init) =>
      init?.method === 'PUT' && url === '/items/1' ? jsonResponse(item('1', 'Tick me', { completed: true })) : undefined
    );
    renderApp();
    const row = (await findSettled('Tick me')).closest('.task-row') as HTMLElement;

    fireEvent.click(within(row).getByRole('checkbox', { name: /^Marquer comme terminée/ }));

    await waitFor(() => expect(screen.queryByText('Tick me')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/items/1', expect.objectContaining({ method: 'PUT' }));
    expect(screen.getByText('Keep me')).toBeInTheDocument();
  });

  describe('without any project', () => {
    const renderWithoutProject = async (items = [] as ReturnType<typeof item>[]) => {
      stubApi(items);
      signIn();
      render(
        <MemoryRouter>
          <AuthProvider>
            <AppDataProvider>
              <DeleteSeedProject />
              <HomePage onSelectProject={() => undefined} />
            </AppDataProvider>
          </AuthProvider>
        </MemoryRouter>
      );
      await screen.findByText('Bonjour Michel 👋');
      fireEvent.click(screen.getByText('delete seed project'));
    };

    test('points the user to the Projects tab instead of a misleading "all done"', async () => {
      await renderWithoutProject();

      expect(await screen.findByText(/Vous n'avez pas encore de projet/)).toBeInTheDocument();
      expect(screen.getByText(/Vous ne participez à aucun projet/)).toBeInTheDocument();
      expect(screen.queryByText('Aucune tâche en cours. 🎉')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mon projet/ })).not.toBeInTheDocument();
    });

    test('unassigned tasks are still listed, without a project label', async () => {
      await renderWithoutProject([item('1', 'Homeless', { projectId: null })]);

      const row = (await screen.findByText('Homeless')).closest('.task-row') as HTMLElement;
      expect(row.querySelector('.project-dot')).not.toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

import { AppDataProvider } from '../context/AppDataProvider';
import { ProjectsPage } from './ProjectsPage';

import {
  bodyOf,
  DeleteSeedProject,
  callsWith,
  findSettled,
  errorResponse,
  item,
  jsonResponse,
  renderApp,
  stubApi,
  stubFetch,
} from '../test/helpers';

const rowOf = (name: string) => screen.getByText(name).closest('.task-row') as HTMLElement;

describe('projects list', () => {
  test('shows a skeleton and hides the create button while loading', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    stubFetch(() => new Promise((r) => (resolve = r)));
    const { container } = renderApp('/projects');

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Nouveau projet' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mon projet')).not.toBeInTheDocument();

    resolve(jsonResponse([]));
    expect(await screen.findByText('Mon projet')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  test('creates a project with the entered name and selected color', async () => {
    stubApi([]);

    renderApp('/projects');

    fireEvent.click(await screen.findByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Mon nouveau projet' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la couleur #f7a24f' }));

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(await screen.findByText('Mon nouveau projet')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('project detail', () => {
  test('shows an empty state for a project without tasks', async () => {
    stubApi([]);
    renderApp('/projects/p-1');
    expect(await screen.findByText("Ce projet n'a pas encore de tâche.")).toBeInTheDocument();
  });

  test('lists every task, completed ones included and struck through', async () => {
    stubApi([item('1', 'Open'), item('2', 'Finished', { completed: true })]);
    renderApp('/projects/p-1');
    await screen.findByText('Open');

    expect(screen.getByText('Finished')).toHaveClass('completed');
    expect(screen.getByText('Open')).not.toHaveClass('completed');
    expect(within(rowOf('Open')).getByRole('checkbox')).not.toBeChecked();
    expect(within(rowOf('Finished')).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf('Finished')).getByRole('checkbox')).toHaveAccessibleName(
      'Marquer comme non terminée : Finished'
    );
  });

  test('deletes the project after confirmation', async () => {
    stubApi([]);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderApp('/projects/p-1');

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le projet' }));

    await waitFor(() => {
      expect(screen.queryByText('Mon projet')).not.toBeInTheDocument();
    });

    expect(window.confirm).toHaveBeenCalledWith('Supprimer le projet "Mon projet" et ses 0 tâche(s) ?');
  });
});

describe('toggling a task', () => {
  test('sends the full item with the flipped flag, then updates the checkbox', async () => {
    const original = item('1', 'Flip me', { description: 'details', priority: 'high', dueDate: '2026-05-01' });
    const api = stubApi([original], (_url, init) =>
      init?.method === 'PUT' ? jsonResponse({ ...original, completed: true }) : undefined
    );
    renderApp('/projects/p-1');
    await findSettled('Flip me');

    fireEvent.click(within(rowOf('Flip me')).getByRole('checkbox'));

    const [put] = callsWith(api, 'PUT');
    expect(put![0]).toBe('/items/1');
    expect(bodyOf(put!)).toEqual({
      name: 'Flip me',
      completed: true,
      description: 'details',
      priority: 'high',
      dueDate: '2026-05-01T00:00:00.000Z',
    });
    expect(await screen.findByRole('checkbox', { name: /^Marquer comme non terminée/ })).toBeChecked();
    expect(screen.getByText('Flip me')).toHaveClass('completed');
  });

  test('un-ticking sends completed=false', async () => {
    const done = item('1', 'Undo me', { completed: true });
    const api = stubApi([done], (_url, init) =>
      init?.method === 'PUT' ? jsonResponse({ ...done, completed: false }) : undefined
    );
    renderApp('/projects/p-1');
    await findSettled('Undo me');

    fireEvent.click(within(rowOf('Undo me')).getByRole('checkbox'));

    expect(bodyOf(callsWith(api, 'PUT')[0]!).completed).toBe(false);
    expect(await screen.findByRole('checkbox', { name: /^Marquer comme terminée/ })).not.toBeChecked();
  });

  test.each([
    [404, 'Not Found'],
    [500, 'Internal Server Error'],
  ])('a failed update (%i) leaves the task untouched and shows "%s"', async (status, statusText) => {
    stubApi([item('1', 'Stubborn')], (_url, init) =>
      init?.method === 'PUT' ? errorResponse(status, statusText) : undefined
    );
    renderApp('/projects/p-1');
    await findSettled('Stubborn');

    fireEvent.click(within(rowOf('Stubborn')).getByRole('checkbox'));

    expect(await findSettled(statusText)).toBeInTheDocument();
    expect(within(rowOf('Stubborn')).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByText('Stubborn')).not.toHaveClass('completed');
  });

  test('a network failure while toggling is surfaced, not swallowed', async () => {
    stubApi([item('1', 'Offline')], (_url, init) =>
      init?.method === 'PUT' ? Promise.reject(new Error('503 Service Unavailable')) : undefined
    );
    renderApp('/projects/p-1');
    await findSettled('Offline');

    fireEvent.click(within(rowOf('Offline')).getByRole('checkbox'));

    expect(await findSettled('Service Unavailable')).toBeInTheDocument();
    expect(within(rowOf('Offline')).getByRole('checkbox')).not.toBeChecked();
  });
});

describe('deleting a task', () => {
  test('DELETEs the right task and removes only that row', async () => {
    const api = stubApi([item('1', 'Goner'), item('2', 'Survivor')], (_url, init) =>
      init?.method === 'DELETE' ? { ok: true, status: 204, statusText: 'No Content' } : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText('Goner');

    fireEvent.click(within(rowOf('Goner')).getByRole('button', { name: /^Supprimer la tâche/ }));

    await waitFor(() => expect(screen.queryByText('Goner')).not.toBeInTheDocument());
    expect(callsWith(api, 'DELETE').map(([url]) => url)).toEqual(['/items/1']);
    expect(screen.getByText('Survivor')).toBeInTheDocument();
  });

  test('a failed delete keeps the row and reports the error', async () => {
    stubApi([item('1', 'Sticky')], (_url, init) =>
      init?.method === 'DELETE' ? errorResponse(500, 'Internal Server Error') : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText('Sticky');

    fireEvent.click(within(rowOf('Sticky')).getByRole('button', { name: /^Supprimer la tâche/ }));

    expect(await screen.findByText('Internal Server Error')).toBeInTheDocument();
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });

  test('the home page offers no delete button', async () => {
    stubApi([item('1', 'Home task')]);
    renderApp('/');
    await screen.findByText('Home task');
    expect(screen.queryByRole('button', { name: /^Supprimer la tâche/ })).not.toBeInTheDocument();
  });
});

describe('kanban view', () => {
  test('the view toggle switches between list and kanban and reports the pressed state', async () => {
    stubApi([item('1', 'Todo')]);
    renderApp('/projects/p-1');
    await screen.findByText('Todo');

    const list = screen.getByRole('button', { name: 'Liste' });
    const kanban = screen.getByRole('button', { name: 'Kanban' });
    expect(list).toHaveAttribute('aria-pressed', 'true');
    expect(kanban).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('heading', { name: /Haute/ })).not.toBeInTheDocument();

    fireEvent.click(kanban);
    expect(kanban).toHaveAttribute('aria-pressed', 'true');
    expect(list).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: /Haute/ })).toBeInTheDocument();

    fireEvent.click(list);
    expect(list).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: /Haute/ })).not.toBeInTheDocument();
  });

  test('the view toggle is hidden for a project without tasks', async () => {
    stubApi([]);
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");
    expect(screen.queryByRole('group', { name: "Mode d'affichage" })).not.toBeInTheDocument();
  });

  test('tasks are grouped in one labelled column per priority', async () => {
    stubApi([item('1', 'Low one', { priority: 'low' }), item('2', 'Urgent one', { priority: 'urgent' })]);
    renderApp('/projects/p-1');
    await screen.findByText('Low one');
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.replace(/\s*\(.*\)/, '').trim())
    ).toEqual(['Basse', 'Moyenne', 'Haute', 'Urgente']);
    const urgent = screen.getByRole('region', { name: /Urgente/ });
    expect(within(urgent).getByText('Urgent one')).toBeInTheDocument();
    expect(within(urgent).queryByText('Low one')).not.toBeInTheDocument();
  });

  test('deleting a task from the kanban is announced', async () => {
    stubApi([item('1', 'Goner'), item('2', 'Stays')], (_url, init) =>
      init?.method === 'DELETE' ? { ok: true, status: 204, statusText: 'No Content' } : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText('Goner');
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la tâche : Goner' }));

    expect(await screen.findByText('Tâche « Goner » supprimée')).toBeInTheDocument();
  });

  test('dragging a task to another column updates its priority', async () => {
    const api = stubApi([item('1', 'Move me')], (_url, init) =>
      init?.method === 'PUT' ? jsonResponse(item('1', 'Move me', { priority: 'high' })) : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText('Move me');
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));

    const dataTransfer = {
      data: '',
      setData(_format: string, value: string) {
        this.data = value;
      },
      getData() {
        return this.data;
      },
    };
    const highColumn = screen.getByRole('heading', { name: /Haute/ }).closest('.kanban-column-body') as HTMLElement;

    fireEvent.dragStart(rowOf('Move me'), { dataTransfer });
    fireEvent.drop(highColumn, { dataTransfer });

    expect(await within(highColumn).findByText('Move me')).toBeInTheDocument();
    const [call] = callsWith(api, 'PUT');
    expect(call![0]).toBe('/items/1');
    expect(bodyOf(call!)).toMatchObject({ name: 'Move me', priority: 'high' });
  });

  test('a task can be moved with the priority dropdown and is announced', async () => {
    const api = stubApi([item('1', 'Move me')], (_url, init) =>
      init?.method === 'PUT' ? jsonResponse(item('1', 'Move me', { priority: 'high' })) : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText('Move me');
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));

    fireEvent.click(screen.getByRole('button', { name: /^Priorité de Move me/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Haute' }));

    expect(await screen.findByText('Tâche « Move me » déplacée vers la colonne Haute')).toBeInTheDocument();
    const [call] = callsWith(api, 'PUT');
    expect(bodyOf(call!)).toMatchObject({ priority: 'high' });
  });
});

describe('projects list without any project', () => {
  test('explains there is nothing yet and offers to create one', async () => {
    stubApi([]);
    render(
      <MemoryRouter>
        <AppDataProvider>
          <DeleteSeedProject />
          <ProjectsPage selectedProjectId={null} onSelectProject={() => undefined} />
        </AppDataProvider>
      </MemoryRouter>
    );
    await screen.findByText('Mon projet');
    fireEvent.click(screen.getByText('delete seed project'));

    expect(screen.getByText(/Vous ne participez à aucun projet/)).toBeInTheDocument();
    expect(screen.queryByText('Mon projet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Nouveau projet' })).toHaveLength(2);
  });
});

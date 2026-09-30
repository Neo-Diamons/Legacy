import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { NotificationContainer } from '../components/NotificationContainer';
import { AuthProvider } from '../services/auth';
import { AppDataProvider } from './AppDataProvider';
import { useAppData } from './appDataContext';
import {
  callsWith,
  emitEvent,
  errorResponse,
  findSettled,
  item,
  jsonResponse,
  stubFetch,
  findSocket,
  MockWebSocket,
  renderApp,
  signIn,
  stubApi,
  stubPendingApi,
} from '../test/helpers';

const rowOf = (name: string) => screen.getByText(name).closest('.task-row') as HTMLElement;

describe('AppDataProvider lifecycle', () => {
  test('opens exactly one websocket and closes it on unmount (no leak)', async () => {
    stubApi([]);
    const { unmount } = renderApp();
    const socket = await findSocket();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socket.closed).toBe(false);

    unmount();
    expect(socket.closed).toBe(true);
  });

  test('re-rendering does not reopen the websocket or refetch items', async () => {
    const fetchMock = stubApi([]);
    const { rerender } = renderApp();
    rerender(<></>);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/items')).toHaveLength(1);
  });
});

const noProjects = (url: string, init?: RequestInit) =>
  url === '/projects' && !init?.method ? jsonResponse([]) : undefined;

describe('project actions (not exposed in the UI yet)', () => {
  function Probe() {
    const { projects, tasks, createProject, deleteProject, createTask, toggleTask, projectStats } = useAppData();
    return (
      <>
        <ul aria-label="tasks">
          {tasks.map((t) => (
            <li key={t.id} data-project={t.projectId}>
              {t.name}
            </li>
          ))}
        </ul>
        <button
          onClick={() =>
            createTask({ name: 'Stray', projectId: 'ghost', priority: 'low', dueDate: null }).catch(() => undefined)
          }
        >
          create in unknown project
        </button>
        <button onClick={() => toggleTask('ghost')}>toggle unknown task</button>
        <ul>
          {projects.map((p) => (
            <li key={p.id} data-color={p.color}>
              {p.name}
            </li>
          ))}
        </ul>
        <output data-testid="stats">{JSON.stringify(projectStats('p-1'))}</output>
        <button onClick={() => createProject({ name: '  Alpha  ', color: '#123456' })}>create</button>
        <button onClick={() => deleteProject('p-1')}>delete seed</button>
      </>
    );
  }

  const renderProbe = () => {
    signIn();
    return render(
      <AuthProvider>
        <AppDataProvider>
          <NotificationContainer />
          <Probe />
        </AppDataProvider>
      </AuthProvider>
    );
  };

  test('createProject appends a project with a trimmed name and a unique id', async () => {
    stubApi([]);
    renderProbe();
    await findSettled('Mon projet');

    fireEvent.click(screen.getByText('create'));
    fireEvent.click(screen.getByText('create'));

    await waitFor(() => expect(screen.getAllByText('Alpha')).toHaveLength(2));
    const alphas = screen.getAllByText('Alpha');
    expect(alphas[0]!.textContent).toBe('Alpha'); // getByText normalizes whitespace, so check the raw text
    expect(alphas[0]).toHaveAttribute('data-color', '#123456');
    expect(screen.getByText('Mon projet')).toBeInTheDocument();
  });

  test('deleteProject removes the project and detaches its tasks', async () => {
    stubApi([item('1', 'Attached')]);
    renderProbe();
    await findSettled('Mon projet');
    await screen.findByText('{"taskCount":1,"completedTaskCount":0}');

    fireEvent.click(screen.getByText('delete seed'));

    await waitFor(() => expect(screen.queryByText('Mon projet')).not.toBeInTheDocument());
    expect(screen.getByTestId('stats')).toHaveTextContent('{"taskCount":0,"completedTaskCount":0}');
  });
  test('toggling an unknown task id does nothing (no request)', async () => {
    const api = stubApi([item('1', 'Known')]);
    renderProbe();
    await findSettled('Known');

    fireEvent.click(screen.getByText('toggle unknown task'));

    expect(callsWith(api, 'PUT')).toHaveLength(0);
  });

  test('a task created for an unknown project is still sent and keeps that project id', async () => {
    const api = stubApi([], (_url, init) =>
      init?.method === 'POST' ? jsonResponse(item('9', 'Stray', { projectId: 'ghost' }), { status: 201 }) : undefined
    );
    renderProbe();
    await findSettled('Mon projet');

    fireEvent.click(screen.getByText('create in unknown project'));

    expect(await screen.findByText('Stray')).toHaveAttribute('data-project', 'ghost');
    expect(callsWith(api, 'POST')).toHaveLength(1);
  });

  test('items loaded after the last project was deleted stay unassigned instead of crashing', async () => {
    stubApi([item('1', 'Late', { projectId: null })], noProjects);
    renderProbe();

    expect(await screen.findByText('Late')).toHaveAttribute('data-project', '');
  });

  test('tasks arriving over the socket with no project stay unassigned', async () => {
    stubApi([], noProjects);
    renderProbe();
    await findSocket();
    await act(async () => undefined);

    emitEvent({ type: 'item.created', item: item('2', 'Orphan', { projectId: null }) });

    expect(screen.getByText('Orphan')).toHaveAttribute('data-project', '');
  });

  test('a rejection that is not an Error is still reported as a server-error toast', async () => {
    stubFetch(() => Promise.reject('gateway exploded'));
    renderProbe();

    await waitFor(() => expect(document.querySelector('i.fa-times-circle')).toBeInTheDocument());
  });

  test('an HTTP error while creating does not add the task', async () => {
    const api = stubApi([], (_url, init) =>
      init?.method === 'POST' ? errorResponse(500, 'Internal Server Error') : undefined
    );
    renderProbe();
    await findSettled('Mon projet');

    fireEvent.click(screen.getByText('create in unknown project'));

    await waitFor(() => expect(callsWith(api, 'POST')).toHaveLength(1));
    expect(screen.queryByText('Stray')).not.toBeInTheDocument();
  });
  test('an item announced over the socket before the initial fetch resolves is not duplicated', async () => {
    const api = stubPendingApi([item('1', 'Early bird'), item('2', 'Regular')]);
    renderProbe();
    await findSocket();

    emitEvent({ type: 'item.created', item: item('1', 'Early bird') });
    await act(async () => api.release());

    expect(await screen.findByText('Regular')).toHaveAttribute('data-project', 'p-1');
    expect(screen.getAllByText('Early bird')).toHaveLength(1);
    expect(screen.getByText('Early bird')).toHaveAttribute('data-project', 'p-1');
  });

  test('the websocket echo arriving before the POST response does not duplicate the task', async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    stubApi([], (_url, init) => (init?.method === 'POST' ? new Promise((r) => (resolvePost = r)) : undefined));
    renderProbe();
    await findSettled('Mon projet');

    fireEvent.click(screen.getByText('create in unknown project'));
    emitEvent({ type: 'item.created', item: item('9', 'Stray', { projectId: 'ghost' }) });
    await act(async () => resolvePost(jsonResponse(item('9', 'Stray', { projectId: 'ghost' }), { status: 201 })));

    expect(screen.getAllByText('Stray')).toHaveLength(1);
    expect(screen.getByText('Stray')).toHaveAttribute('data-project', 'ghost');
  });
});

describe('live sync from other tabs (websocket)', () => {
  test('item.created from another client appears in the project', async () => {
    stubApi([]);
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    emitEvent({ type: 'item.created', item: item('5', 'From elsewhere') });

    expect(screen.getByText('From elsewhere')).toBeInTheDocument();
    expect(screen.queryByText("Ce projet n'a pas encore de tâche.")).not.toBeInTheDocument();
  });

  test('item.updated replaces the task in place', async () => {
    stubApi([item('1', 'Before'), item('2', 'Neighbour')]);
    renderApp('/projects/p-1');
    await screen.findByText('Before');

    emitEvent({ type: 'item.updated', item: item('1', 'After', { completed: true, priority: 'urgent' }) });

    expect(screen.queryByText('Before')).not.toBeInTheDocument();
    expect(within(rowOf('After')).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf('After')).getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Neighbour')).toBeInTheDocument();
  });

  test('item.updated for an unknown id is ignored rather than inserted', async () => {
    stubApi([item('1', 'Known')]);
    renderApp('/projects/p-1');
    await screen.findByText('Known');

    emitEvent({ type: 'item.updated', item: item('ghost', 'Ghost') });

    expect(screen.queryByText('Ghost')).not.toBeInTheDocument();
    expect(screen.getByText('Known')).toBeInTheDocument();
  });

  test('item.deleted removes the task and updates the project stats', async () => {
    stubApi([item('1', 'Vanishing')]);
    renderApp('/projects');
    fireEvent.click(await screen.findByRole('button', { name: /Mon projet/ }));
    await screen.findByText('Vanishing');

    emitEvent({ type: 'item.deleted', id: '1' });
    expect(screen.queryByText('Vanishing')).not.toBeInTheDocument();
    expect(screen.getByText("Ce projet n'a pas encore de tâche.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retour aux projets/ }));
    expect(
      within(await screen.findByRole('button', { name: /Mon projet/ })).getByText('Aucune tâche')
    ).toBeInTheDocument();
  });

  test('item.deleted for an unknown id changes nothing', async () => {
    stubApi([item('1', 'Untouched')]);
    renderApp('/projects/p-1');
    await screen.findByText('Untouched');

    emitEvent({ type: 'item.deleted', id: 'ghost' });

    expect(screen.getByText('Untouched')).toBeInTheDocument();
  });
});

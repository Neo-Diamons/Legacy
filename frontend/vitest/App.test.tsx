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

  test('creates a new project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    expect(screen.getByText('Mon projet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Nouveau projet' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(await screen.findByText('Nouveau projet')).toBeInTheDocument();
  });

  test('does not create a project with an empty name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    expect(screen.getByText('Mon projet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    const createButton = screen.getByRole('button', {
      name: 'Créer le projet',
    });

    expect(createButton).toBeDisabled();

    expect(screen.getByText('Mon projet')).toBeInTheDocument();
  });

  test('trims spaces from a project name when creating it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Nouveau projet' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom du projet'),
      {
        target: { value: '   Projet avec espaces   ' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer le projet' }),
    );

    expect(
      await screen.findByText('Projet avec espaces'),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('   Projet avec espaces   '),
    ).not.toBeInTheDocument();
  });

  test('creates multiple projects independently', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    // Create first new project
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Projet A' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(await screen.findByText('Projet A')).toBeInTheDocument();

    // Create the second new project
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Projet B' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(await screen.findByText('Projet B')).toBeInTheDocument();

    // 3 projects should be visible now: the default "Mon projet" and the two newly created ones
    expect(screen.getByText('Mon projet')).toBeInTheDocument();
    expect(screen.getByText('Projet A')).toBeInTheDocument();
    expect(screen.getByText('Projet B')).toBeInTheDocument();
  });

  test('creates a project with the selected color', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Projet coloré' },
    });

    const colorButton = screen.getByRole('button', {
      name: 'Choisir la couleur #f7a24f',
    });

    fireEvent.click(colorButton);

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    const projectCard = screen
      .getByText('Projet coloré')
      .closest('.project-card') as HTMLElement;

    expect(projectCard).toBeInTheDocument();

    const projectDot = projectCard.querySelector('.project-dot');

    expect(projectDot).toHaveStyle({
      backgroundColor: '#f7a24f',
    });
  });

  test('cancels project creation without creating a project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Nouveau projet' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom du projet'),
      {
        target: { value: 'Projet annulé' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Annuler' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.queryByText('Projet annulé'),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText('Mon projet'),
    ).toBeInTheDocument();
  });

  test('closes the project creation modal after creating a project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Nouveau projet' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom du projet'),
      {
        target: { value: 'Nouveau projet' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer le projet' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('Nouveau projet'),
    ).toBeInTheDocument();
  });

  test('opens a newly created project when its card is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Nouveau projet' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom du projet'),
      {
        target: { value: 'Projet sélectionné' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer le projet' }),
    );

    const projectCard = await screen.findByText('Projet sélectionné');

    fireEvent.click(
      projectCard.closest('.project-card') as HTMLElement,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Projet sélectionné',
      }),
    ).toBeInTheDocument();
  });

  test('creates a task in the selected project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              item('task-project-1', 'Tâche du projet'),
            ),
        }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /\+ ajouter une tâche/i }),
    );

    const taskNameInput = screen.getByRole('textbox', {
      name: /nom/i,
    });

    fireEvent.change(taskNameInput, {
      target: { value: 'Tâche du projet' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /créer/i }),
    );

    expect(
      await screen.findByText('Tâche du projet'),
    ).toBeInTheDocument();
  });

  test('allows editing a project name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    expect(nameInput).toHaveValue('Mon projet');

    fireEvent.change(nameInput, {
      target: { value: 'Mon projet modifié' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Mon projet modifié' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Mon projet' }),
    ).not.toBeInTheDocument();
  });

  test('opens the project edit form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    expect(
      screen.getByRole('textbox', { name: /nom du projet/i }),
    ).toBeInTheDocument();
  });

  test('does not save an empty project name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    fireEvent.change(nameInput, {
      target: { value: '   ' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Mon projet' }),
    ).toBeInTheDocument();
  });

  test('cancels project name editing without saving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    fireEvent.change(nameInput, {
      target: { value: 'Nom qui ne sera pas sauvegardé' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Annuler' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Mon projet' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Nom qui ne sera pas sauvegardé',
      }),
    ).not.toBeInTheDocument();
  });

  test('closes project editing without saving when the modal is closed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    fireEvent.change(nameInput, {
      target: { value: 'Nom abandonné' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Close' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { name: 'Mon projet' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: 'Nom abandonné' }),
    ).not.toBeInTheDocument();
  });

  test('trims spaces from a project name when editing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    fireEvent.change(nameInput, {
      target: { value: '   Projet modifié   ' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Projet modifié',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: '   Projet modifié   ',
      }),
    ).not.toBeInTheDocument();
  });

  test('updates the project name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/items' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'task-project-name',
                name: 'Ma tâche',
                description: null,
                completed: false,
                priority: 'medium',
                dueDate: null,
                overdue: false,
                createdAt: '2026-01-14T00:00:00.000Z',
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Ajouter une tâche' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom'),
      {
        target: { value: 'Ma tâche' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer la tâche' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Ma tâche'),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /modifier le projet/i }),
    );

    const nameInput = screen.getByRole('textbox', {
      name: /nom du projet/i,
    });

    fireEvent.change(nameInput, {
      target: { value: 'Projet renommé' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Projet renommé' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ma tâche'),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Mon projet'),
    ).not.toBeInTheDocument();
  });

  test('updates the project name on its associated tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            item('task-1', 'Ma tâche'),
          ]),
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    expect(
      await screen.findByText('Ma tâche'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Modifier le projet',
      }),
    );

    const input = screen.getByRole('textbox', {
      name: 'Nom du projet',
    });

    fireEvent.change(input, {
      target: { value: 'Projet modifié' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Enregistrer',
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Projet modifié',
      }),
    ).toBeInTheDocument();
  });

  test('keeps the project when deletion is cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    const deleteButton = screen.getByRole('button', {
      name: 'Supprimer le projet',
    });

    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Supprimer le projet "Mon projet" et ses 0 tâche(s) ?',
    );

    expect(
      screen.getByText('Mon projet'),
    ).toBeInTheDocument();
  });

  test('deletes a project after confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    fireEvent.click(screen.getByText('Mon projet').closest('.project-card') as HTMLElement);

    const deleteButton = screen.getByRole('button', {
      name: 'Supprimer le projet',
    });

    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Supprimer le projet "Mon projet" et ses 0 tâche(s) ?',
    );

    expect(screen.queryByText('Mon projet')).not.toBeInTheDocument();
  });

  test('deleting a task keeps its project', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            item('task-delete', 'Tâche à supprimer'),
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Supprimer la tâche',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/items/task-delete',
      { method: 'DELETE' },
    );

    await waitFor(() => {
      expect(
        screen.queryByText('Tâche à supprimer'),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Retour aux projets',
      }),
    );

    expect(
      screen.getByText('Mon projet'),
    ).toBeInTheDocument();
  });

  test('keeps project tasks when project deletion is cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(
            [
              item('task-delete-cancel', 'Tâche à conserver'),
            ],
          ),
        }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    expect(
      await screen.findByText('Tâche à conserver'),
    ).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(
      screen.getByRole('button', { name: 'Supprimer le projet' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Mon projet' }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Tâche à conserver'),
    ).toBeInTheDocument();
  });

  test('deletes a project and its associated tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/items' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'task-to-delete',
                name: 'Tâche du projet',
                description: null,
                completed: false,
                priority: 'medium',
                dueDate: null,
                overdue: false,
                createdAt: '2026-01-14T00:00:00.000Z',
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }),
    );

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Ajouter une tâche' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom'),
      {
        target: { value: 'Tâche du projet' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer la tâche' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Tâche du projet'),
      ).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', {
      name: 'Supprimer le projet',
    });

    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Supprimer le projet "Mon projet" et ses 1 tâche(s) ?',
    );

    expect(
      screen.queryByText('Mon projet'),
    ).not.toBeInTheDocument();
  });

  test('returns to the project list after deleting the current project', async () => {
    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    expect(
      screen.getByRole('heading', { name: 'Mon projet' }),
    ).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Supprimer le projet',
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Mon projet' }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { name: 'Projets' }),
    ).toBeInTheDocument();
  });

  test('keeps tasks associated with their project when switching projects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/items' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'task-project-1',
                name: 'Tâche du premier projet',
                description: null,
                completed: false,
                priority: 'medium',
                dueDate: null,
                overdue: false,
                createdAt: '2026-01-14T00:00:00.000Z',
              }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));

    // Create a 2nd project
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau projet' }));

    fireEvent.change(screen.getByLabelText('Nom du projet'), {
      target: { value: 'Deuxième projet' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }));

    expect(screen.getByText('Mon projet')).toBeInTheDocument();
    expect(screen.getByText('Deuxième projet')).toBeInTheDocument();

    // Open "Mon projet"
    fireEvent.click(screen.getByText('Mon projet').closest('.project-card') as HTMLElement);

    // Add a task to the project
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une tâche' }));

    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Tâche du premier projet' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }));

    await waitFor(() => {
      expect(screen.getByText('Tâche du premier projet')).toBeInTheDocument();
    });

    // Returnal to project list
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux projets' }));

    // Open the second project
    fireEvent.click(screen.getByText('Deuxième projet').closest('.project-card') as HTMLElement);

    // first project's task should not be visible on 2nd project
    expect(screen.queryByText('Tâche du premier projet')).not.toBeInTheDocument();
  });

  test('restores the tasks when returning to a project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              item('task-project-a', 'Tâche du projet A'),
            ),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve(
              item('task-project-b', 'Tâche du projet B'),
            ),
        }),
    );

    render(<App />);

    await screen.findByText('Bonjour Michel 👋');

    fireEvent.click(
      screen.getByRole('button', { name: 'Projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /\+ ajouter une tâche/i }),
    );

    fireEvent.change(
      screen.getByRole('textbox', { name: /nom/i }),
      {
        target: { value: 'Tâche du projet A' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: /créer/i }),
    );

    expect(
      await screen.findByText('Tâche du projet A'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retour aux projets' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: '+ Nouveau projet' }),
    );

    fireEvent.change(
      screen.getByLabelText('Nom du projet'),
      {
        target: { value: 'Projet B' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Créer le projet' }),
    );

    const projectB = await screen.findByText('Projet B');

    fireEvent.click(
      projectB.closest('.project-card') as HTMLElement,
    );

    expect(
      screen.getByRole('heading', { name: 'Projet B' }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Tâche du projet A'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retour aux projets' }),
    );

    fireEvent.click(
      screen.getByText('Mon projet').closest('.project-card') as HTMLElement,
    );

    expect(
      await screen.findByText('Tâche du projet A'),
    ).toBeInTheDocument();
  });
});

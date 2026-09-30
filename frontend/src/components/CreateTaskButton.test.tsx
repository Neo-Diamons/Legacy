import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { bodyOf, callsWith, emitEvent, errorResponse, item, jsonResponse, renderApp, stubApi } from '../test/helpers';

const openModal = () => fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une tâche' }));

const submitButton = () => screen.getByRole('button', { name: 'Créer la tâche' });

const modalGone = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

describe('creating a task', () => {
  const created = item('9', 'Write tests', { priority: 'urgent', dueDate: '2026-05-01' });

  test('sends trimmed name, priority and due date, then shows the new task once', async () => {
    const api = stubApi([], (_url, init) =>
      init?.method === 'POST' ? jsonResponse(created, { status: 201, statusText: 'Created' }) : undefined
    );
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: '  Write tests  ' } });
    fireEvent.change(screen.getByLabelText('Priorité'), { target: { value: 'urgent' } });
    fireEvent.change(screen.getByLabelText('Échéance (optionnelle)'), {
      target: { value: '2026-05-01T15:30' },
    });
    fireEvent.click(submitButton());

    const [post] = callsWith(api, 'POST');
    expect(post![0]).toBe('/items');
    expect(bodyOf(post!)).toEqual({ name: 'Write tests', description: null, priority: 'urgent', dueDate: '2026-05-01T13:30:00.000Z', });

    expect(await screen.findByText('Write tests')).toBeInTheDocument();
    expect(screen.queryByText("Ce projet n'a pas encore de tâche.")).not.toBeInTheDocument();
    await modalGone();
  });

  test('defaults to medium priority and a null due date', async () => {
    const api = stubApi([], (_url, init) => (init?.method === 'POST' ? jsonResponse(created) : undefined));
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    expect(screen.getByLabelText('Priorité')).toHaveValue('medium');
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Quick one' } });
    fireEvent.click(submitButton());

    expect(bodyOf(callsWith(api, 'POST')[0]!)).toEqual({ name: 'Quick one', description: null, priority: 'medium', dueDate: null, });
  });

  test.each([[''], ['   ']])('cannot submit a blank name (%j)', async (name) => {
    const api = stubApi([]);
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: name } });
    expect(submitButton()).toBeDisabled();

    // Bypass the disabled button (e.g. Enter key): the handler must still refuse.
    fireEvent.submit(screen.getByLabelText('Nom').closest('form') as HTMLFormElement);
    expect(callsWith(api, 'POST')).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('"Annuler" closes the modal without a request and resets the form for next time', async () => {
    const api = stubApi([]);
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Abandoned' } });
    fireEvent.change(screen.getByLabelText('Priorité'), { target: { value: 'high' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await modalGone();

    openModal();
    expect(screen.getByLabelText('Nom')).toHaveValue('');
    expect(screen.getByLabelText('Priorité')).toHaveValue('medium');
    expect(callsWith(api, 'POST')).toHaveLength(0);
  });

  test('a rejected creation adds no task and reports the API error', async () => {
    stubApi([], (_url, init) => (init?.method === 'POST' ? errorResponse(422, 'Unprocessable Entity') : undefined));
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Rejected' } });
    fireEvent.click(submitButton());

    expect(await screen.findByText('Unprocessable Entity')).toBeInTheDocument();
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
    expect(screen.getByText("Ce projet n'a pas encore de tâche.")).toBeInTheDocument();
  });

  test('the POST response and the websocket echo of the same task do not duplicate it', async () => {
    stubApi([], (_url, init) => (init?.method === 'POST' ? jsonResponse(created) : undefined));
    renderApp('/projects/p-1');
    await screen.findByText("Ce projet n'a pas encore de tâche.");

    openModal();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Write tests' } });
    fireEvent.click(submitButton());
    await screen.findByText('Write tests');

    emitEvent({ type: 'item.created', item: created });
    expect(screen.getAllByText('Write tests')).toHaveLength(1);

    // ...and the same in the opposite order: echo first, response second, for another id.
    const other = item('10', 'Echo first');
    emitEvent({ type: 'item.created', item: other });
    emitEvent({ type: 'item.created', item: other });
    expect(screen.getAllByText('Echo first')).toHaveLength(1);
  });
});

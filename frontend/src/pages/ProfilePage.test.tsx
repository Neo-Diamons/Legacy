import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { item, jsonResponse, renderApp, stubApi, stubFetch } from '../test/helpers';

const stat = (label: string) => screen.getByText(label, { selector: '.stat-label' }).parentElement as HTMLElement;
const save = () => screen.getByRole('button', { name: 'Enregistrer' });
const nameInput = () => screen.getByLabelText('Nom affiché');

describe('profile page', () => {
  test('shows a placeholder, not the form, while loading', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    stubFetch(() => new Promise((r) => (resolve = r)));
    renderApp('/profile');

    expect(screen.queryByLabelText('Nom affiché')).not.toBeInTheDocument();
    expect(screen.queryByText('Profil')).not.toBeInTheDocument();

    resolve(jsonResponse([]));
    expect(await screen.findByLabelText('Nom affiché')).toBeInTheDocument();
  });

  test('shows the identity of the user', async () => {
    stubApi([]);
    renderApp('/profile');
    await screen.findByLabelText('Nom affiché');

    expect(screen.getByText('michel.dupont@example.com')).toBeInTheDocument();
    expect(screen.getByText('Membre depuis le 14 janv. 2026')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Michel Dupont');
    expect(document.querySelector('.profile-avatar')).toHaveTextContent('MD');
  });

  test('counts projects, tasks and completed tasks', async () => {
    stubApi([item('1', 'A', { completed: true }), item('2', 'B'), item('3', 'C', { completed: true })]);
    renderApp('/profile');
    await waitFor(() => expect(within(stat('Tâches')).getByText('3')).toBeInTheDocument());

    expect(within(stat('Projets')).getByText('1')).toBeInTheDocument();
    expect(within(stat('Terminées')).getByText('2')).toBeInTheDocument();
    expect(within(stat('Taux de complétion')).getByText('67%')).toBeInTheDocument();
  });

  test.each([
    [0, 0, '0%'],
    [1, 0, '0%'],
    [3, 1, '33%'],
    [3, 2, '67%'],
    [2, 2, '100%'],
  ])('completion rate for %i tasks with %i done is %s', async (total, done, rate) => {
    stubApi(Array.from({ length: total }, (_, i) => item(String(i), `T${i}`, { completed: i < done })));
    renderApp('/profile');
    expect(await screen.findByText(rate)).toBeInTheDocument();
  });

  test('an empty account shows 0% instead of NaN%', async () => {
    stubApi([]);
    renderApp('/profile');
    await screen.findByLabelText('Nom affiché');
    expect(within(stat('Taux de complétion')).getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  describe('renaming', () => {
    test('save is disabled until the name really changes', async () => {
      stubApi([]);
      renderApp('/profile');
      await screen.findByLabelText('Nom affiché');
      expect(save()).toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: 'Michel Dupont ' } });
      expect(save()).toBeDisabled(); // only trailing whitespace added

      fireEvent.change(nameInput(), { target: { value: '   ' } });
      expect(save()).toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: '' } });
      expect(save()).toBeDisabled();

      fireEvent.change(nameInput(), { target: { value: 'Élodie Martin' } });
      expect(save()).toBeEnabled();
    });

    test('saving trims the name and updates avatar, profile and home greeting', async () => {
      stubApi([]);
      renderApp('/profile');
      await screen.findByLabelText('Nom affiché');

      fireEvent.change(nameInput(), { target: { value: '  Élodie Martin  ' } });
      fireEvent.click(save());

      expect(screen.getByText('Élodie Martin', { selector: '.fw-semibold' })).toBeInTheDocument();
      expect(document.querySelector('.profile-avatar')).toHaveTextContent('ÉM');
      expect(screen.getByRole('button', { name: 'Menu utilisateur' })).toHaveTextContent('ÉM');
      expect(save()).toBeDisabled(); // input still holds the padded value, which trims to the saved name

      fireEvent.click(screen.getByRole('link', { name: 'Accueil' }));
      expect(await screen.findByText('Bonjour Élodie 👋')).toBeInTheDocument();
    });

    test('a blank name submitted by bypassing the button is ignored', async () => {
      stubApi([]);
      renderApp('/profile');
      await screen.findByLabelText('Nom affiché');

      fireEvent.change(nameInput(), { target: { value: '   ' } });
      fireEvent.submit(nameInput().closest('form') as HTMLFormElement);

      expect(screen.getByText('Michel Dupont', { selector: '.fw-semibold' })).toBeInTheDocument();
      expect(document.querySelector('.profile-avatar')).toHaveTextContent('MD');
    });
  });
});

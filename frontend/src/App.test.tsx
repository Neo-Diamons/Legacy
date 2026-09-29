import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { item, renderApp, stubApi } from './test/helpers';

const pathname = () => screen.getByTestId('location').textContent;

describe('routing', () => {
  test.each([
    ['/', 'Bonjour Michel 👋'],
    ['/projects', 'Projets'],
    ['/projects/p-1', 'Mon projet'],
    ['/profile', 'Profil'],
  ])('%s renders its page', async (route, heading) => {
    stubApi([]);
    renderApp(route);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(pathname()).toBe(route);
  });

  test.each(['/nope', '/projects/p-1/extra', '/profile/x'])('unknown path %s redirects to /', async (route) => {
    stubApi([]);
    renderApp(route);
    expect(await screen.findByText('Bonjour Michel 👋')).toBeInTheDocument();
    expect(pathname()).toBe('/');
  });

  test('an unknown project id falls back to the project list instead of a blank page', async () => {
    stubApi([]);
    renderApp('/projects/does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Projets' })).toBeInTheDocument();
    expect(screen.getByText('Mon projet')).toBeInTheDocument();
  });

  test('exposes header, nav, main and footer landmarks', async () => {
    stubApi([]);
    renderApp();
    await screen.findByText('Bonjour Michel 👋');

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Legacy Todo App');
    expect(document.querySelector('header.app-topbar')).toContainElement(screen.getByRole('navigation'));
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });

  test('nav items are real links so pages are reachable by URL', () => {
    stubApi([]);
    renderApp();
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Projets' })).toHaveAttribute('href', '/projects');
  });

  test.each([
    ['/', 'Accueil'],
    ['/projects', 'Projets'],
    ['/projects/p-1', 'Projets'],
  ])('%s highlights the "%s" tab', (route, active) => {
    stubApi([]);
    renderApp(route);
    for (const name of ['Accueil', 'Projets']) {
      const link = screen.getByRole('link', { name });
      if (name === active) expect(link).toHaveClass('active');
      else expect(link).not.toHaveClass('active');
    }
  });

  test('no tab is highlighted on the profile page', () => {
    stubApi([]);
    renderApp('/profile');
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Projets' })).not.toHaveClass('active');
  });

  test('clicking a nav link changes the URL and the page', async () => {
    stubApi([]);
    renderApp();
    fireEvent.click(screen.getByRole('link', { name: 'Projets' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projets' })).toBeInTheDocument();
    expect(pathname()).toBe('/projects');

    fireEvent.click(screen.getByRole('link', { name: 'Accueil' }));
    expect(await screen.findByText('Bonjour Michel 👋')).toBeInTheDocument();
    expect(pathname()).toBe('/');
  });

  test('a project card opens /projects/:id and "Retour" goes back to /projects', async () => {
    stubApi([item('1', 'Task')]);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Mon projet/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mon projet' })).toBeInTheDocument();
    expect(pathname()).toBe('/projects/p-1');

    fireEvent.click(screen.getByRole('button', { name: /Retour aux projets/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projets' })).toBeInTheDocument();
    expect(pathname()).toBe('/projects');
  });

  describe('user menu', () => {
    test('"Profil" navigates to /profile', async () => {
      stubApi([]);
      renderApp();
      fireEvent.click(screen.getByRole('button', { name: 'Menu utilisateur' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Profil' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
      expect(pathname()).toBe('/profile');
    });

    test('"Déconnexion" only warns (no auth yet) and stays on the page', async () => {
      stubApi([]);
      const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
      renderApp();
      fireEvent.click(screen.getByRole('button', { name: 'Menu utilisateur' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }));

      expect(alert).toHaveBeenCalledOnce();
      expect(alert.mock.calls[0]![0]).toMatch(/Déconnexion/);
      expect(pathname()).toBe('/');
    });

    test('shows the user initials', () => {
      stubApi([]);
      renderApp();
      expect(screen.getByRole('button', { name: 'Menu utilisateur' })).toHaveTextContent('MD');
    });
  });

  test('navigating between pages keeps loaded data (no refetch)', async () => {
    const fetchMock = stubApi([item('1', 'Persistent task')]);
    renderApp();
    await screen.findByText('Persistent task');

    fireEvent.click(screen.getByRole('link', { name: 'Projets' }));
    fireEvent.click(await screen.findByRole('button', { name: /Mon projet/ }));

    expect(await screen.findByText('Persistent task')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

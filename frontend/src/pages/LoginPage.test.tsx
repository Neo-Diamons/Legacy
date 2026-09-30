import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { USER, bodyOf, callsWith, jsonResponse, renderApp, stubApi, validToken } from '../test/helpers';

const openRegister = () => {
  renderApp('/', { signedIn: false });
  fireEvent.click(screen.getByRole('button', { name: 'Pas de compte ? Créer un compte' }));
};

const fillRegister = () => {
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: USER.name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: USER.email } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'correct horse battery' } });
};

describe('privacy consent at signup', () => {
  test('the consent checkbox is required and unchecked by default', () => {
    stubApi([]);
    openRegister();

    const checkbox = screen.getByRole('checkbox', { name: /politique de confidentialité/ });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeRequired();
  });

  test('links to the privacy policy', () => {
    stubApi([]);
    openRegister();

    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/privacy');
  });

  test('there is no consent checkbox on the login form', () => {
    stubApi([]);
    renderApp('/', { signedIn: false });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('sends acceptPrivacyPolicy with the registration', async () => {
    const fetchMock = stubApi([], (url, init) =>
      url === '/auth/register' && init?.method === 'POST'
        ? jsonResponse({ token: validToken(), user: USER }, { status: 201 })
        : undefined
    );
    openRegister();
    fillRegister();
    fireEvent.click(screen.getByRole('checkbox', { name: /politique de confidentialité/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => expect(callsWith(fetchMock, 'POST')).toHaveLength(1));
    expect(bodyOf(callsWith(fetchMock, 'POST')[0]!)).toEqual({
      name: USER.name,
      email: USER.email,
      password: 'correct horse battery',
      acceptPrivacyPolicy: true,
    });
  });
});

describe('privacy policy page', () => {
  test('is reachable without being signed in', () => {
    stubApi([]);
    renderApp('/privacy', { signedIn: false });

    expect(screen.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Durée de conservation' })).toBeInTheDocument();
  });

  test('is reachable from the footer when signed in', async () => {
    stubApi([]);
    renderApp();

    expect(await screen.findByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/privacy');
  });
});

import { useState, type SubmitEvent } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';

import { useAuth } from '../services/authContext';

type Mode = 'login' | 'register';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      // On success the AuthProvider stores the session and App swaps this page for the app shell.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Card.Body>
          <h1 className="auth-title">{isRegister ? 'Inscription' : 'Connexion'}</h1>
          <p className="text-muted">
            {isRegister ? 'Créez votre compte pour commencer.' : 'Connectez-vous pour accéder à vos projets.'}
          </p>

          <Form onSubmit={submit}>
            {isRegister && (
              <Form.Group controlId="auth-name" className="mb-3">
                <Form.Label>Nom</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  autoFocus
                />
              </Form.Group>
            )}

            <Form.Group controlId="auth-email" className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus={!isRegister}
              />
            </Form.Group>

            <Form.Group controlId="auth-password" className="mb-3">
              <Form.Label>Mot de passe</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={isRegister ? 12 : undefined}
                required
              />
              {isRegister && <Form.Text className="text-muted">12 caractères minimum.</Form.Text>}
            </Form.Group>

            {error && (
              <Alert variant="danger" role="alert" className="py-2 small">
                {error}
              </Alert>
            )}

            <Button type="submit" variant="success" className="w-100" disabled={submitting}>
              {isRegister ? 'Créer mon compte' : 'Se connecter'}
            </Button>
          </Form>

          <div className="text-center mt-3">
            <Button variant="link" size="sm" onClick={switchMode}>
              {isRegister ? 'J’ai déjà un compte' : 'Pas de compte ? Créer un compte'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

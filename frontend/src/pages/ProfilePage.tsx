import { useState, type SubmitEvent } from 'react';
import { Alert, Button, Col, Form, Modal, Placeholder, Row } from 'react-bootstrap';

import { useAppData } from '../context/appDataContext';
import { useAuth } from '../services/authContext';
import { formatDate, initialsOf } from '../utils/format';

export function ProfilePage() {
  const { loading, user, projects, tasks, updateUserName } = useAppData();
  const { changePassword, deleteAccount } = useAuth();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateUserName(name);
      setName(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le nom.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Impossible de supprimer le compte.');
      setDeletingAccount(false);
    }
  };

  const submitPassword = async (e: SubmitEvent) => {
    e.preventDefault();
    setPasswordChanged(false);
    if (newPassword.length < 12) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('Le nouveau mot de passe doit être différent de l’actuel.');
      return;
    }
    setChangingPassword(true);
    setPasswordError(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordChanged(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Impossible de changer le mot de passe.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <Placeholder as="h1" animation="glow">
          <Placeholder xs={3} />
        </Placeholder>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Profil</h1>
      </header>

      <div className="widget-card profile-card">
        <div className="profile-identity">
          <div className="profile-avatar">{initialsOf(user.name)}</div>
          <div>
            <div className="fw-semibold">{user.name}</div>
            <div className="text-muted small">{user.email}</div>
            <div className="text-muted small">Membre depuis le {formatDate(user.joinedAt)}</div>
          </div>
        </div>

        <Form onSubmit={submit} className="profile-name-form">
          <Form.Group controlId="profile-name" className="mb-2">
            <Form.Label>Nom affiché</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Group>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            variant="success"
            size="sm"
            disabled={saving || !name.trim() || name.trim() === user.name}
          >
            Enregistrer
          </Button>
        </Form>

        <div className="profile-delete-action">
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            disabled={deletingAccount}
          >
            Supprimer mon compte
          </Button>
        </div>
      </div>

      <div className="widget-card profile-card mt-3">
        <Form onSubmit={submitPassword} className="profile-password-form">
          <h2 className="h6 mb-3">Changer mot de passe</h2>
          <Form.Group controlId="profile-current-password" className="mb-2">
            <Form.Label>Mot de passe actuel</Form.Label>
            <Form.Control
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Form.Group>
          <Form.Group controlId="profile-new-password" className="mb-2">
            <Form.Label>Nouveau mot de passe</Form.Label>
            <Form.Control
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
            <Form.Text className="text-muted">12 caractères minimum.</Form.Text>
          </Form.Group>
          <Form.Group controlId="profile-confirm-password" className="mb-2">
            <Form.Label>Confirmer le nouveau mot de passe</Form.Label>
            <Form.Control
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Form.Group>
          {passwordError && (
            <Alert variant="danger" role="alert" className="py-2 small">
              {passwordError}
            </Alert>
          )}
          {passwordChanged && (
            <Alert variant="success" role="status" className="py-2 small">
              Mot de passe modifié. Vos autres sessions ont été déconnectées.
            </Alert>
          )}
          <Button
            type="submit"
            variant="success"
            size="sm"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            Changer le mot de passe
          </Button>
        </Form>
      </div>

      <Modal show={showDeleteModal} onHide={() => !deletingAccount && setShowDeleteModal(false)} centered>
        <Modal.Header closeButton={!deletingAccount}>
          <Modal.Title>Supprimer le compte ?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Cette action est définitive. Le compte <strong>{user.email}</strong> ainsi que tous ses projets et tâches
            seront supprimés.
          </p>
          <p className="mb-3 text-danger fw-semibold">Cette action ne peut pas être annulée.</p>
          {deleteError && (
            <Alert variant="danger" role="alert" className="py-2 small mb-0">
              {deleteError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deletingAccount}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleDeleteAccount} disabled={deletingAccount}>
            {deletingAccount ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Row className="g-3 mt-1">
        <Col xs={6} md={3}>
          <StatCard label="Projets" value={projects.length} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Tâches" value={tasks.length} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Terminées" value={completedTasks} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Taux de complétion" value={`${completionRate}%`} />
        </Col>
      </Row>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

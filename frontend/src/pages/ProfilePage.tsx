import { useState, type FormEvent } from 'react';
import { Button, Col, Form, Placeholder, Row } from 'react-bootstrap';

import { useAppData } from '../context/appDataContext';
import { formatDate, initialsOf } from '../utils/format';

export function ProfilePage() {
  const { loading, user, projects, tasks, updateUserName } = useAppData();
  const [name, setName] = useState(user.name);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    updateUserName(name);
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
          <Button type="submit" variant="success" size="sm" disabled={!name.trim() || name.trim() === user.name}>
            Enregistrer
          </Button>
        </Form>
      </div>

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

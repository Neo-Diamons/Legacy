import { Alert, Col, Placeholder, Row } from 'react-bootstrap';

import { useHomeData } from '../../hooks/useHomeData';
import { ProjectsWidget } from './ProjectsWidget';
import { TasksWidget } from './TasksWidget';

export function Home() {
  const { user, tasks, projects, loading, error } = useHomeData();

  if (error) {
    return (
      <Alert variant="danger" className="mt-3">
        {error}
      </Alert>
    );
  }

  return (
    <div className="home-screen">
      <header className="home-header">
        {loading || !user ? (
          <Placeholder as="h1" animation="glow" className="home-greeting">
            <Placeholder xs={4} />
          </Placeholder>
        ) : (
          <h1 className="home-greeting">Bonjour {user.name.split(' ')[0]} 👋</h1>
        )}
        <p className="text-muted">Voici votre travail en cours.</p>
      </header>

      <Row className="g-4">
        <Col md={7}>
          <TasksWidget tasks={tasks} loading={loading} />
        </Col>
        <Col md={5}>
          <ProjectsWidget projects={projects} loading={loading} />
        </Col>
      </Row>
    </div>
  );
}

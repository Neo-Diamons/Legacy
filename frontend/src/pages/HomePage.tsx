import { Alert, Col, Placeholder, Row } from 'react-bootstrap';

import { ProjectCard } from '../components/ProjectCard';
import { TaskRow } from '../components/TaskRow';
import { useAppData } from '../context/appDataContext';

const MAX_TASKS_SHOWN = 6;

export function HomePage() {
  const { loading, user, projects, tasks, toggleTask, projectStats } = useAppData();

  const upcomingTasks = [...tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, MAX_TASKS_SHOWN);

  return (
    <div className="page">
      <header className="page-header">
        {loading ? (
          <Placeholder as="h1" animation="glow" className="page-greeting">
            <Placeholder xs={4} />
          </Placeholder>
        ) : (
          <h1 className="page-greeting">Bonjour {user.name.split(' ')[0]} 👋</h1>
        )}
        <p className="text-muted">Voici votre travail en cours.</p>
      </header>

      <Row className="g-4">
        <Col md={7}>
          <section className="widget-card" aria-labelledby="home-tasks-title">
            <h2 id="home-tasks-title" className="widget-title">
              Mes tâches
            </h2>

            {loading && <TasksSkeleton />}

            {!loading && projects.length === 0 && (
              <Alert variant="light" className="empty-state mb-0">
                Vous n'avez pas encore de projet. Rendez-vous dans l'onglet <strong>Projets</strong> pour en créer un.
              </Alert>
            )}

            {!loading && projects.length > 0 && upcomingTasks.length === 0 && (
              <p className="empty-state">Aucune tâche en cours. 🎉</p>
            )}

            {!loading &&
              upcomingTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                return <TaskRow key={task.id} task={task} project={project} onToggle={toggleTask} />;
              })}
          </section>
        </Col>

        <Col md={5}>
          <section className="widget-card" aria-labelledby="home-projects-title">
            <h2 id="home-projects-title" className="widget-title">
              Mes projets
            </h2>

            {loading && <ProjectsSkeleton />}

            {!loading && projects.length === 0 && (
              <p className="empty-state mb-0">
                Vous ne participez à aucun projet pour le moment. Rendez-vous dans l'onglet <strong>Projets</strong>{' '}
                pour en créer un.
              </p>
            )}

            <div className="project-grid">
              {!loading &&
                projects.map((project) => (
                  <ProjectCard key={project.id} project={project} stats={projectStats(project.id)} />
                ))}
            </div>
          </section>
        </Col>
      </Row>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((row) => (
        <Placeholder key={row} as="p" animation="glow" className="mb-3">
          <Placeholder xs={7} /> <Placeholder xs={3} />
        </Placeholder>
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      {[0, 1].map((row) => (
        <Placeholder key={row} as="p" animation="glow" className="mb-3">
          <Placeholder xs={5} />
          <Placeholder xs={12} className="d-block" style={{ height: 8 }} />
        </Placeholder>
      ))}
    </div>
  );
}

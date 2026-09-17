import { Card, ListGroup, Placeholder, ProgressBar } from 'react-bootstrap';

import type { Project } from '../../types';

export function ProjectsWidget({ projects, loading }: { projects: Project[] | null; loading: boolean }) {
  return (
    <Card className="home-widget">
      <Card.Body>
        <Card.Title as="h2" className="home-widget-title">
          Mes projets
        </Card.Title>

        {loading && <ProjectsWidgetSkeleton />}

        {!loading && projects && projects.length === 0 && (
          <p className="home-empty-state">
            Vous ne participez à aucun projet pour le moment. Rejoignez-en un pour le voir apparaître ici.
          </p>
        )}

        {!loading && projects && projects.length > 0 && (
          <ListGroup variant="flush">
            {projects.map((project) => {
              const progress =
                project.taskCount === 0 ? 0 : Math.round((project.completedTaskCount / project.taskCount) * 100);
              return (
                <ListGroup.Item key={project.id} className="home-project-row">
                  <div className="home-project-header">
                    <span className="home-project-dot" style={{ backgroundColor: project.color }} />
                    <span className="home-project-name">{project.name}</span>
                    <span className="text-muted small ms-auto">
                      {project.completedTaskCount}/{project.taskCount} tâches
                    </span>
                  </div>
                  <ProgressBar now={progress} className="home-project-progress" />
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
}

function ProjectsWidgetSkeleton() {
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

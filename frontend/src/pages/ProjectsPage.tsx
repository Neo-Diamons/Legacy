import { Button, Placeholder } from 'react-bootstrap';

import { CreateProjectButton } from '../components/CreateProjectButton';
import { CreateTaskButton } from '../components/CreateTaskButton';
import { ProjectCard } from '../components/ProjectCard';
import { TaskRow } from '../components/TaskRow';
import { useAppData } from '../context/appDataContext';

export function ProjectsPage({
  selectedProjectId,
  onSelectProject,
}: {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}) {
  const { loading, projects, projectStats } = useAppData();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (selectedProject) {
    return <ProjectDetail projectId={selectedProject.id} onBack={() => onSelectProject(null)} />;
  }

  return (
    <div className="page">
      <header className="page-header page-header-row">
        <div>
          <h1 className="page-title">Projets</h1>
          <p className="text-muted">Tous les projets auxquels vous participez.</p>
        </div>
        {!loading && <CreateProjectButton />}
      </header>

      {loading && (
        <div aria-busy="true" aria-live="polite">
          {[0, 1].map((row) => (
            <Placeholder key={row} as="p" animation="glow" className="mb-3">
              <Placeholder xs={4} />
              <Placeholder xs={12} className="d-block" style={{ height: 8 }} />
            </Placeholder>
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="empty-state">
          <p>Vous ne participez à aucun projet pour le moment. Créez-en un pour commencer.</p>
          <CreateProjectButton />
        </div>
      )}

      <div className="project-grid">
        {!loading &&
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              stats={projectStats(project.id)}
              onClick={() => onSelectProject(project.id)}
            />
          ))}
      </div>
    </div>
  );
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { projects, tasks, toggleTask, deleteTask, deleteProject } = useAppData();
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  if (!project) return null;

  const handleDeleteProject = () => {
    if (window.confirm(`Supprimer le projet "${project.name}" et ses ${projectTasks.length} tâche(s) ?`)) {
      deleteProject(project.id);
      onBack();
    }
  };

  return (
    <div className="page">
      <Button variant="link" className="back-link" onClick={onBack}>
        <i className="fa fa-arrow-left me-2" />
        Retour aux projets
      </Button>

      <header className="page-header page-header-row">
        <div className="project-detail-title">
          <span className="project-dot" style={{ backgroundColor: project.color }} />
          <h1 className="page-title mb-0">{project.name}</h1>
        </div>
        <div className="d-flex gap-2">
          <CreateTaskButton projectId={project.id} />
          <Button variant="outline-danger" size="sm" disabled title="Bientôt disponible" onClick={handleDeleteProject}>
            Supprimer le projet
          </Button>
        </div>
      </header>

      {projectTasks.length === 0 ? (
        <p className="empty-state">Ce projet n'a pas encore de tâche.</p>
      ) : (
        <div className="widget-card">
          {projectTasks.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
          ))}
        </div>
      )}
    </div>
  );
}

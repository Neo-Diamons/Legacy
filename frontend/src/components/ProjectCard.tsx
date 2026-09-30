import { Card, ProgressBar } from 'react-bootstrap';

import type { Project, ProjectStats } from '../types';

export function ProjectCard({
  project,
  stats,
  onClick,
}: {
  project: Project;
  stats: ProjectStats;
  onClick?: () => void;
}) {
  const progress = stats.taskCount === 0 ? 0 : Math.round((stats.completedTaskCount / stats.taskCount) * 100);

  return (
    <Card
      className={`project-card ${onClick ? 'project-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Card.Body>
        <div className="project-card-header">
          <span className="project-dot" style={{ backgroundColor: project.color }} aria-hidden="true" />
          <span className="project-name">{project.name}</span>
        </div>
        <div className="text-muted small mb-2">
          {stats.taskCount === 0 ? 'Aucune tâche' : `${stats.completedTaskCount}/${stats.taskCount} tâches terminées`}
        </div>
        <ProgressBar
          now={progress}
          className="project-progress"
          label={`${progress} %`}
          visuallyHidden
          aria-label={`Progression de ${project.name}`}
        />
      </Card.Body>
    </Card>
  );
}

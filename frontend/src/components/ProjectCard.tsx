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
    >
      <Card.Body>
        <div className="project-card-header">
          <span className="project-dot" style={{ backgroundColor: project.color }} />
          <span className="project-name">{project.name}</span>
        </div>
        <div className="text-muted small mb-2">
          {stats.taskCount === 0 ? 'Aucune tâche' : `${stats.completedTaskCount}/${stats.taskCount} tâches terminées`}
        </div>
        <ProgressBar now={progress} className="project-progress" />
      </Card.Body>
    </Card>
  );
}

import { Badge, Button, Form } from 'react-bootstrap';

import type { Project, Task } from '../types';
import { formatShortDate } from '../utils/format';

const PRIORITY_LABELS: Record<Task['priority'], { label: string; variant: string }> = {
  high: { label: 'Haute', variant: 'danger' },
  medium: { label: 'Moyenne', variant: 'warning' },
  low: { label: 'Basse', variant: 'secondary' },
};

export function TaskRow({
  task,
  project,
  onToggle,
  onDelete,
}: {
  task: Task;
  project?: Project;
  onToggle: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}) {
  return (
    <div className="task-row">
      <Form.Check
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-label={task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
        className="task-row-check"
      />
      <div className="task-row-body">
        <span className={`task-row-title ${task.completed ? 'completed' : ''}`}>{task.title}</span>
        <span className="task-row-meta">
          <Badge bg={PRIORITY_LABELS[task.priority].variant} className="me-2">
            {PRIORITY_LABELS[task.priority].label}
          </Badge>
          {project && (
            <span className="text-muted small me-2">
              <span className="project-dot project-dot-inline" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          )}
          <span className="text-muted small">
            {task.dueDate ? `Échéance ${formatShortDate(task.dueDate)}` : 'Sans échéance'}
          </span>
        </span>
      </div>
      {onDelete && (
        <Button
          size="sm"
          variant="link"
          className="task-row-delete"
          onClick={() => onDelete(task.id)}
          aria-label="Supprimer la tâche"
        >
          <i className="fa fa-trash text-danger" />
        </Button>
      )}
    </div>
  );
}

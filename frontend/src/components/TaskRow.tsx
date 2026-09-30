import { useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import type { DragEvent } from 'react';

import type { Project, Task, TaskPriority } from '../types';
import { formatShortDate, PRIORITY_LABELS } from '../utils/format';

export function TaskRow({
  task,
  project,
  onToggle,
  onDragStart,
  onDelete,
  onMove,
  onEdit,
}: {
  task: Task;
  project?: Project;
  onToggle: (taskId: string) => void;
  onDragStart?: (event: DragEvent<HTMLLIElement>) => void;
  onDelete?: (taskId: string) => void;
  onMove: (taskId: string, priority: TaskPriority) => void;
  onEdit?: (taskId: string) => void;
}) {
  const [now] = useState(() => Date.now());

  const isOverdue =
    !task.completed &&
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < now;

  return (
    <li
      className={`task-row ${isOverdue ? 'task-row-overdue' : ''}`}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
    >
      <Form.Check
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-label={`${task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'} : ${task.name}`}
        className="task-row-check"
      />
      <div className="task-row-body">
        <div className={`task-row-title ${task.completed ? 'completed' : ''}`}>
          {task.name}
          {task.completed && <span className="visually-hidden"> (terminée)</span>}
        </div>
        <div className="task-row-meta">
          <Dropdown className="d-inline-block me-2" onSelect={(key) => key && onMove(task.id, key as TaskPriority)}>
            <Dropdown.Toggle
              as="button"
              type="button"
              className={`badge border-0 bg-${PRIORITY_LABELS[task.priority].variant} task-row-priority`}
              aria-label={`Priorité de ${task.name} : ${PRIORITY_LABELS[task.priority].label}. Changer la priorité`}
            >
              {PRIORITY_LABELS[task.priority].label}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                <Dropdown.Item key={priority} eventKey={priority} active={priority === task.priority}>
                  {PRIORITY_LABELS[priority].label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {project && (
            <>
              <span className="text-muted small me-2">
                <span className="visually-hidden">Projet : </span>
                <span
                  className="project-dot project-dot-inline"
                  style={{ backgroundColor: project.color }}
                  aria-hidden="true"
                />
                {project.name}
              </span>
              <span className="visually-hidden">. </span>
            </>
          )}
          <span className="text-muted small">
            {task.dueDate ? `Échéance ${formatShortDate(task.dueDate)}` : 'Sans échéance'}
          </span>
        </div>
      </div>
      {onEdit && (
        <Button
          size="sm"
          variant="link"
          className="task-row-edit"
          onClick={() => onEdit(task.id)}
          aria-label="Modifier la tâche"
        >
          <i className="fa fa-pencil text-primary" aria-hidden="true" />
        </Button>
      )}
      {onDelete && (
        <Button
          size="sm"
          variant="link"
          className="task-row-delete"
          onClick={() => onDelete(task.id)}
          aria-label={`Supprimer la tâche : ${task.name}`}
        >
          <i className="fa fa-trash text-danger" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

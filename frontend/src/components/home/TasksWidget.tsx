import { Badge, Card, ListGroup, Placeholder } from 'react-bootstrap';

import type { Task } from '../../types';

const PRIORITY_LABELS: Record<Task['priority'], { label: string; variant: string }> = {
  high: { label: 'Haute', variant: 'danger' },
  medium: { label: 'Moyenne', variant: 'warning' },
  low: { label: 'Basse', variant: 'secondary' },
};

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'Sans échéance';
  const date = new Date(dueDate);
  return `Échéance ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

export function TasksWidget({ tasks, loading }: { tasks: Task[] | null; loading: boolean }) {
  return (
    <Card className="home-widget">
      <Card.Body>
        <Card.Title as="h2" className="home-widget-title">
          Mes tâches
        </Card.Title>

        {loading && <TasksWidgetSkeleton />}

        {!loading && tasks && tasks.length === 0 && (
          <p className="home-empty-state">
            Aucune tâche ne vous est assignée pour le moment. Profitez-en, ou ajoutez-en une !
          </p>
        )}

        {!loading && tasks && tasks.length > 0 && (
          <ListGroup variant="flush">
            {tasks.map((task) => (
              <ListGroup.Item key={task.id} className="home-task-row">
                <span className={`home-task-title ${task.completed ? 'completed' : ''}`}>{task.title}</span>
                <span className="home-task-meta">
                  <Badge bg={PRIORITY_LABELS[task.priority].variant} className="me-2">
                    {PRIORITY_LABELS[task.priority].label}
                  </Badge>
                  <span className="text-muted small">
                    {task.projectName} · {formatDueDate(task.dueDate)}
                  </span>
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
}

function TasksWidgetSkeleton() {
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

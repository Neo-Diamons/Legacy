import type { DragEvent } from 'react';
import type { Task, TaskPriority } from '../types';
import { PRIORITY_LABELS } from '../utils/format';
import { TaskRow } from './TaskRow';

export function KanbanColumn({
  tasks,
  category,
  toggleTask,
  updateTaskPriority,
  deleteTask,
}: {
  tasks: Task[];
  category: TaskPriority;
  toggleTask: (task: string) => void;
  updateTaskPriority: (task: string, priority: TaskPriority) => void;
  deleteTask: (task: string) => void;
}) {
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) updateTaskPriority(taskId, category);
  };

  const headingId = `kanban-column-${category}`;

  return (
    <section
      className="kanban-column-body"
      aria-labelledby={headingId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <h2 id={headingId} className="kanban-column-title">
        {PRIORITY_LABELS[category].label}{' '}
        <span className="visually-hidden">
          ({tasks.length} tâche{tasks.length > 1 ? 's' : ''})
        </span>
      </h2>
      <ul className="task-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={toggleTask}
            onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
            onMove={updateTaskPriority}
            onDelete={deleteTask}
          />
        ))}
      </ul>
    </section>
  );
}

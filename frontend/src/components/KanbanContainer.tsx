import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import type { Project, Task, TaskPriority } from '../types';
import { PRIORITY_LABELS } from '../utils/format';

export function KanbanContainer({
  tasks,
  project,
  toggleTask,
  updateTaskPriority,
  deleteTask,
}: {
  tasks: Task[];
  project: Project;
  toggleTask: (taskId: string) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  deleteTask: (taskId: string) => void;
}) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);

  const columns: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const [announcement, setAnnouncement] = useState('');

  const handleMove = (taskId: string, priority: TaskPriority) => {
    const task = projectTasks.find((t) => t.id === taskId);
    if (task && task.priority !== priority) {
      setAnnouncement(`Tâche « ${task.name} » déplacée vers la colonne ${PRIORITY_LABELS[priority].label}`);
    }
    updateTaskPriority(taskId, priority);
  };

  const handleDelete = (taskId: string) => {
    const task = projectTasks.find((t) => t.id === taskId);
    if (task) setAnnouncement(`Tâche « ${task.name} » supprimée`);
    deleteTask(taskId);
  };

  return (
    <div className="KanbanPage">
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {columns.map((category) => (
        <KanbanColumn
          key={category}
          tasks={projectTasks.filter((task) => task.priority === category)}
          category={category}
          toggleTask={toggleTask}
          updateTaskPriority={handleMove}
          deleteTask={handleDelete}
        />
      ))}
    </div>
  );
}

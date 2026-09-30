import { KanbanColumn } from './KanbanColumn';
import type { Project, Task, TaskPriority } from '../types';

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

  return (
    <div className="KanbanPage">
      {columns.map((category) => (
        <KanbanColumn
          key={category}
          tasks={projectTasks.filter((task) => task.priority === category)}
          category={category}
          toggleTask={toggleTask}
          updateTaskPriority={updateTaskPriority}
          deleteTask={deleteTask}
        />
      ))}
    </div>
  );
}
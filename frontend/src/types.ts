export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string; // ISO date
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string; // ISO date
}

export interface Task {
  id: string;
  title: string;
  projectId: string; // every task belongs to exactly one project
  dueDate: string | null; // ISO date, null when no deadline
  priority: TaskPriority;
  completed: boolean;
  createdAt: string; // ISO date
}

export interface ProjectStats {
  taskCount: number;
  completedTaskCount: number;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  joinedAt: string; // ISO date
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string; // ISO date
}

export interface Task {
  id: string;
  name: string;
  projectId: string; // every task belongs to exactly one project
  projectName: string;
  description: string | null;
  dueDate: string | null; // ISO date, null when no deadline
  priority: TaskPriority;
  completed: boolean;
  createdAt: string; // ISO date
}

export interface ProjectStats {
  taskCount: number;
  completedTaskCount: number;
}

export interface Notification {
  id: string;
  message: string;
  httpCode: number;
  createdAt: string; // ISO date
}
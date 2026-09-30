import { createContext, useContext } from 'react';

import type { CurrentUser, Project, ProjectStats, Task, TaskPriority, Notification } from '../types';

export interface NewProjectInput {
  name: string;
  color: string;
}

export interface NewTaskInput {
  name: string;
  description: string;
  projectId: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface AppDataContextValue {
  loading: boolean;
  user: CurrentUser;
  projects: Project[];
  tasks: Task[];
  notifications: Notification[];
  createProject: (input: NewProjectInput) => Project;
  deleteProject: (projectId: string) => void;
  updateProjectName: (projectId: string, name: string) => void;
  createTask: (input: NewTaskInput) => Task;
  updateTaskName: (
    taskId: string,
    name: string,
    priority?: TaskPriority,
    dueDate?: string | null,
    description?: string | null
  ) => void;
  toggleTask: (taskId: string) => void;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => void;
  deleteTask: (taskId: string) => void;
  updateUserName: (name: string) => void;
  removeNotification: (id: string) => void;
  projectStats: (projectId: string) => ProjectStats;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within an <AppDataProvider>');
  }
  return ctx;
}

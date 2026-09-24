import { createContext, useContext } from 'react';

import type { CurrentUser, Project, ProjectStats, Task, TaskPriority } from '../types';

export interface NewProjectInput {
  name: string;
  color: string;
}

export interface NewTaskInput {
  name: string;
  projectId: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface AppDataContextValue {
  loading: boolean;
  user: CurrentUser;
  projects: Project[];
  tasks: Task[];
  createProject: (input: NewProjectInput) => Project;
  updateProjectName: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  createTask: (input: NewTaskInput) => Task;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  updateUserName: (name: string) => void;
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

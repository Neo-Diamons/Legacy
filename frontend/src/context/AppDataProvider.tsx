import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CurrentUser, Project, ProjectStats, Task } from '../types';
import { AppDataContext, type AppDataContextValue, type NewProjectInput, type NewTaskInput } from './appDataContext';

/**
 * TODO(backend): this whole file is a mock persistence layer.
 *
 * The real backend currently exposes a single global, user-less `/items`
 * list (see backend/routes/*.js) — there is no authentication and no
 * notion of "project" yet. This provider stands in for that future API:
 * - `GET /me`                    -> seeds `user`
 * - `GET/POST/DELETE /projects`  -> seeds/mutates `projects`
 * - `GET/POST/PATCH/DELETE /projects/:id/tasks` -> seeds/mutates `tasks`
 *
 * Everything here lives in React state only: it resets on every page
 * reload. That's expected for a mock — once real endpoints exist, only
 * the bodies of the functions below need to change; every component that
 * calls `useAppData()` can stay exactly as it is.
 */

const SEED_USER: CurrentUser = {
  id: 'u-1',
  name: 'Michel Dupont',
  email: 'michel.dupont@example.com',
  joinedAt: '2026-01-14',
};

const SEED_PROJECTS: Project[] = [
  { id: 'p-1', name: 'Site vitrine client', color: '#4f8ef7', createdAt: '2026-02-03' },
  { id: 'p-2', name: 'Refonte API interne', color: '#f7a24f', createdAt: '2026-03-11' },
];

const SEED_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Relire la maquette de la page contact',
    projectId: 'p-1',
    dueDate: '2026-09-14',
    priority: 'high',
    completed: false,
    createdAt: '2026-09-01',
  },
  {
    id: 't-2',
    title: 'Ecrire les tests pour la route de login',
    projectId: 'p-2',
    dueDate: '2026-09-18',
    priority: 'medium',
    completed: false,
    createdAt: '2026-09-02',
  },
  {
    id: 't-3',
    title: 'Préparer la démo du sprint',
    projectId: 'p-1',
    dueDate: '2026-09-12',
    priority: 'high',
    completed: false,
    createdAt: '2026-09-03',
  },
  {
    id: 't-4',
    title: 'Mettre à jour le wiki de contribution',
    projectId: 'p-2',
    dueDate: null,
    priority: 'low',
    completed: true,
    createdAt: '2026-08-20',
  },
];

// Simulated network latency for the initial load, kept low so the app stays
// snappy (acceptance criterion: "Loads within acceptable time").
const INITIAL_LOAD_MS = 250;

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser>(SEED_USER);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProjects(SEED_PROJECTS);
      setTasks(SEED_TASKS);
      setLoading(false);
    }, INITIAL_LOAD_MS);
    return () => clearTimeout(timer);
  }, []);

  const createProject = (input: NewProjectInput): Project => {
    const project: Project = {
      id: generateId('p'),
      name: input.name.trim(),
      color: input.color,
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => [...prev, project]);
    return project;
  };

  const deleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    setTasks((prev) => prev.filter((task) => task.projectId !== projectId));
  };

  const createTask = (input: NewTaskInput): Task => {
    const task: Task = {
      id: generateId('t'),
      title: input.title.trim(),
      projectId: input.projectId,
      priority: input.priority,
      dueDate: input.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, task]);
    return task;
  };

  const toggleTask = (taskId: string) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)));
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const updateUserName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUser((prev) => ({ ...prev, name: trimmed }));
  };

  const projectStats = (projectId: string): ProjectStats => {
    const projectTasks = tasks.filter((task) => task.projectId === projectId);
    return {
      taskCount: projectTasks.length,
      completedTaskCount: projectTasks.filter((task) => task.completed).length,
    };
  };

  const value = useMemo<AppDataContextValue>(
    () => ({
      loading,
      user,
      projects,
      tasks,
      createProject,
      deleteProject,
      createTask,
      toggleTask,
      deleteTask,
      updateUserName,
      projectStats,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action creators are stable enough for this mock store
    [loading, user, projects, tasks]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

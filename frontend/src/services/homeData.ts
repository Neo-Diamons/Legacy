import type { CurrentUser, Project, Task } from '../types';

/**
 * TODO(backend): this module is a stand-in for the real API.
 * The backend currently exposes a single global, user-less `/items` list
 * (see backend/routes/*.js) — there is no authentication, no per-user
 * scoping and no notion of "project" yet.
 *
 * Once those exist, replace the three functions below with real calls, e.g.:
 *   GET /me            -> CurrentUser
 *   GET /me/tasks       -> Task[]
 *   GET /me/projects    -> Project[]
 *
 * Keeping the async function signatures identical means the rest of the
 * Home screen (hooks/useHomeData.ts and the widgets) will not need to change.
 */

// Simulated network latency, kept low so the home screen stays snappy
// (acceptance criterion: "Loads within acceptable time").
const MOCK_LATENCY_MS = 250;

function delay<T>(value: T, ms: number = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

const mockCurrentUser: CurrentUser = {
  id: 'u-1',
  name: 'Michel Dupont',
  avatarInitials: 'CD',
};

const mockProjects: Project[] = [
  { id: 'p-1', name: 'Site vitrine client', color: '#4f8ef7', taskCount: 8, completedTaskCount: 5 },
  { id: 'p-2', name: 'Refonte API interne', color: '#f7a24f', taskCount: 4, completedTaskCount: 1 },
  { id: 'p-3', name: 'Sprint qualité', color: '#4fbf7c', taskCount: 3, completedTaskCount: 3 },
];

const mockTasks: Task[] = [
  {
    id: 't-1',
    name: 'Relire la maquette de la page contact',
    projectId: 'p-1',
    projectName: 'Site vitrine client',
    dueDate: '2026-09-10',
    priority: 'high',
    completed: false,
  },
  {
    id: 't-2',
    name: 'Ecrire les tests pour /me/tasks',
    projectId: 'p-2',
    projectName: 'Refonte API interne',
    dueDate: '2026-09-12',
    priority: 'medium',
    completed: false,
  },
  {
    id: 't-3',
    name: 'Préparer la démo du sprint',
    projectId: 'p-3',
    projectName: 'Sprint qualité',
    dueDate: '2026-09-09',
    priority: 'high',
    completed: false,
  },
  {
    id: 't-4',
    name: 'Mettre à jour le wiki de contribution',
    projectId: 'p-3',
    projectName: 'Sprint qualité',
    dueDate: null,
    priority: 'low',
    completed: true,
  },
];

/** Fetches the currently logged-in user's profile. */
export function fetchCurrentUser(): Promise<CurrentUser> {
  return delay(mockCurrentUser);
}

/** Fetches the tasks assigned to (or owned by) the current user. */
export function fetchMyTasks(): Promise<Task[]> {
  return delay(mockTasks);
}

/** Fetches the projects the current user is a member of. */
export function fetchMyProjects(): Promise<Project[]> {
  return delay(mockProjects);
}

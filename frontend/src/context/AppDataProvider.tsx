import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CurrentUser, Project, ProjectStats, Task, Notification, TaskPriority } from '../types';
import { AppDataContext, type AppDataContextValue, type NewProjectInput, type NewTaskInput } from './appDataContext';
import { createItem, deleteItem, fetchItems, openItemSocket, updateItem, type ItemResponse } from '../services/items';

/**
 * TODO(backend): `user` and `projects` are still a mock.
 *
 * The real backend exposes a single global, user-less `/items` list (and a
 * `/ws` socket broadcasting item.created/updated/deleted) — no
 * authentication and no notion of "project" yet. Tasks below are backed by
 * that real API; project assignment is tracked client-side only until a
 * real projects endpoint exists.
 *
 * - `GET /me`                    -> would seed `user`
 * - `GET/POST/DELETE /projects`  -> would seed/mutate `projects`
 */

const SEED_USER: CurrentUser = {
  id: 'u-1',
  name: 'Michel Dupont',
  email: 'michel.dupont@example.com',
  joinedAt: '2026-01-14',
};

const SEED_PROJECTS: Project[] = [{ id: 'p-1', name: 'Mon projet', color: '#4f8ef7', createdAt: '2026-01-14' }];

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function toTask(item: ItemResponse, projects: Project[], assignments: Record<string, string>): Task {
  const projectId = assignments[item.id] ?? '';
  const project = projects.find((p) => p.id === projectId);
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    projectId,
    projectName: project?.name ?? '',
    dueDate: item.dueDate,
    priority: item.priority,
    completed: item.completed,
    createdAt: item.createdAt,
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser>(SEED_USER);
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (httpCode: number, message: string) => {
      const notification: Notification = {
        id: generateId('n'),
        httpCode,
        message,
        createdAt: new Date().toISOString(),
      };

      setNotifications((prev) => [...prev, notification]);

      setTimeout(() => {
        removeNotification(notification.id);
      }, 2000);
    },
    [removeNotification]
  );

  const formatPopUpAndAddNotification = useCallback(
    (error: Error) => {
      const message = error instanceof Error ? error.message : String(error);
      const [statusText, ...messageParts] = message.split(' ');
      const status = Number(statusText) || 500;

      addNotification(status, messageParts.join(' '));
    },
    [addNotification]
  );

  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    fetchItems()
      .then((fetched) => {
        setItems(fetched);
        // Every existing item defaults to the current first project until real project scoping exists.
        setAssignments((prev) => {
          const defaultProjectId = projectsRef.current[0]?.id;
          if (!defaultProjectId) return prev;
          const next = { ...prev };
          for (const item of fetched) {
            if (!(item.id in next)) next[item.id] = defaultProjectId;
          }
          return next;
        });
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      })
      .finally(() => setLoading(false));

    return openItemSocket((event) => {
      switch (event.type) {
        case 'item.created':
          setItems((prev) => (prev.some((i) => i.id === event.item.id) ? prev : [...prev, event.item]));
          setAssignments((prev) => {
            const defaultProjectId = projectsRef.current[0]?.id;
            if (event.item.id in prev || !defaultProjectId) return prev;
            return { ...prev, [event.item.id]: defaultProjectId };
          });
          addNotification(201, 'Task created!');
          break;
        case 'item.updated':
          {
            const wasCompleted = itemsRef.current.find((i) => i.id === event.item.id)?.completed;
            setItems((prev) => prev.map((i) => (i.id === event.item.id ? event.item : i)));
            if (event.item.completed) addNotification(204, 'Task completed!');
            else addNotification(204, wasCompleted ? 'Task uncompleted!' : 'Task updated!');
          }
          break;
        case 'item.deleted':
          setItems((prev) => prev.filter((i) => i.id !== event.id));
          setAssignments((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== event.id)));
          addNotification(204, 'Task deleted!');
          break;
      }
    });
  }, [formatPopUpAndAddNotification, addNotification]);

  const tasks = useMemo(() => items.map((item) => toTask(item, projects, assignments)), [items, projects, assignments]);

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

  const updateProjectName = (projectId: string, name: string) => {
    const trimmed = name.trim();

    if (!trimmed) return;

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, name: trimmed }
          : project,
      ),
    );
  };

  const updateTaskName = (
    taskId: string,
    name: string,
    priority?: TaskPriority,
    dueDate?: string | null,
    description?: string | null,
  ) => {
    const task = itemsRef.current.find((item) => item.id === taskId);
    const trimmed = name.trim();

    if (!task || !trimmed) return;

    updateItem(taskId, {
      name: trimmed,
      completed: task.completed,
      description: description === undefined ? task.description : description,
      priority: priority ?? task.priority,
      dueDate: dueDate === undefined ? task.dueDate : dueDate,
    })
      .then((updated) => {
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      })
      .catch(console.error);
  };

  const deleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    setAssignments((prev) => Object.fromEntries(Object.entries(prev).filter(([, pid]) => pid !== projectId)));
  };

  const createTask = (input: NewTaskInput): Task => {
    const project = projects.find((p) => p.id === input.projectId);

    createItem({
      name: input.name.trim(),
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
    })
      .then(({ item }) => {
        // ← directement ici
        setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
        setAssignments((prev) => ({ ...prev, [item.id]: input.projectId }));
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      });

    // NewTaskInput/createTask's contract requires a synchronous return, but no current
    // caller reads it — the real task is applied above once the API call resolves.
    return {
      id: generateId('t'),
      name: input.name.trim(),
      projectId: input.projectId,
      projectName: project?.name ?? '',
      description: input.description ?? null,
      priority: input.priority,
      dueDate: input.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
  };

  const toggleTask = (taskId: string) => {
    const item = itemsRef.current.find((i) => i.id === taskId);
    if (!item) return;
    updateItem(taskId, {
      name: item.name,
      completed: !item.completed,
      description: item.description,
      priority: item.priority,
      dueDate: item.dueDate,
    })
      .then(({ item }) => {
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      });
  };

  const updateTaskPriority = (taskId: string, priority: Task['priority']) => {
    const item = itemsRef.current.find((i) => i.id === taskId);
    if (!item || item.priority === priority) return;

    updateItem(taskId, {
      name: item.name,
      completed: item.completed,
      description: item.description,
      priority,
      dueDate: item.dueDate,
    })
      .then(({ item: updatedItem }) => {
        setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      });
  };

  const deleteTask = (taskId: string) => {
    deleteItem(taskId)
      .then(() => {
        setItems((prev) => prev.filter((i) => i.id !== taskId));
        setAssignments((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== taskId)));
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      });
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
      notifications,
      removeNotification,
      createProject,
      updateProjectName,
      updateTaskName,
      deleteProject,
      createTask,
      toggleTask,
      updateTaskPriority,
      deleteTask,
      updateUserName,
      projectStats,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action creators close over up-to-date state each render
    [loading, user, projects, tasks, notifications]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

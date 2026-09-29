import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CurrentUser, Project, ProjectStats, Task, Notification, TaskPriority } from '../types';
import { AppDataContext, type AppDataContextValue, type NewProjectInput, type NewTaskInput } from './appDataContext';
import { createItem, deleteItem, fetchItems, openItemSocket, updateItem, type ItemResponse } from '../services/items';
import { useAuth } from '../services/authContext';
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  fetchProjects,
} from '../services/projects';

/**
 * `user` comes from the authenticated session (see services/auth.tsx); items and
 * projects are backed by the real `/items` and `/projects` APIs, and `/ws`
 * broadcasts item.created/updated/deleted events.
 */

const SEED_USER: CurrentUser = {
  id: 'u-1',
  name: 'Michel Dupont',
  email: 'michel.dupont@example.com',
  joinedAt: '2026-01-14',
};

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function toTask(item: ItemResponse, projects: Project[], assignments: Record<string, string>): Task {
  const projectId = item.projectId ?? assignments[item.id] ?? '';
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
  const { user: authenticatedUser, updateName } = useAuth();
  const [loading, setLoading] = useState(true);
  const user: CurrentUser = authenticatedUser
    ? {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        joinedAt: authenticatedUser.createdAt,
      }
    : SEED_USER;
  const [projects, setProjects] = useState<Project[]>([]);
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
    Promise.all([fetchItems(), fetchProjects()])
      .then(([fetched, fetchedProjects]) => {
        setItems(fetched);
        setProjects(fetchedProjects);
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

  const createProject = async (input: NewProjectInput): Promise<Project> => {
    const project = await createProjectRequest({ name: input.name.trim(), color: input.color });
    setProjects((prev) => [...prev, project]);
    return project;
  };

  const updateProjectName = (projectId: string, name: string) => {
    const trimmed = name.trim();

    if (!trimmed) return;

    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, name: trimmed } : project)));
  };

  const updateTaskName = (
    taskId: string,
    name: string,
    priority?: TaskPriority,
    dueDate?: string | null,
    description?: string | null
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
      .then(({ item: updatedItem }) => {
        setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
      })
      .catch(console.error);
  };

  const deleteProject = (projectId: string) => {
    deleteProjectRequest(projectId)
      .then(() => {
        setProjects((prev) => prev.filter((project) => project.id !== projectId));
        setAssignments((prev) => Object.fromEntries(Object.entries(prev).filter(([, pid]) => pid !== projectId)));
      })
      .catch((error) => {
        formatPopUpAndAddNotification(error);
      });
  };

  const createTask = async (input: NewTaskInput): Promise<Task> => {
    const project = projects.find((p) => p.id === input.projectId);

    const { item } = await createItem({
      name: input.name.trim(),
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
      projectId: input.projectId,
    });
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    setAssignments((prev) => ({ ...prev, [item.id]: input.projectId }));

    return {
      id: item.id,
      name: input.name.trim(),
      projectId: input.projectId,
      projectName: project?.name ?? '',
      description: input.description ?? null,
      priority: input.priority,
      dueDate: item.dueDate,
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

  const updateUserName = async (name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateName(trimmed);
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

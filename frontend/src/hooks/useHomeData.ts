import { useEffect, useState } from 'react';

import { fetchCurrentUser, fetchMyProjects, fetchMyTasks } from '../services/homeData';
import type { CurrentUser, Project, Task } from '../types';

interface HomeData {
  user: CurrentUser | null;
  tasks: Task[] | null;
  projects: Project[] | null;
  loading: boolean;
  error: string | null;
}

const initialState: HomeData = {
  user: null,
  tasks: null,
  projects: null,
  loading: true,
  error: null,
};

/**
 * Loads everything the personalized home screen needs.
 *
 * The three calls are fired together (Promise.all) instead of one after the
 * other, so the screen's load time is bounded by the slowest single call
 * rather than their sum — this is what keeps "Loads within acceptable time"
 * true even once these are wired to real network requests.
 */
export function useHomeData(): HomeData {
  const [state, setState] = useState<HomeData>(initialState);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchCurrentUser(), fetchMyTasks(), fetchMyProjects()])
      .then(([user, tasks, projects]) => {
        if (cancelled) return;
        setState({ user, tasks, projects, loading: false, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          user: null,
          tasks: null,
          projects: null,
          loading: false,
          error: 'Impossible de charger votre espace pour le moment. Réessayez dans quelques instants.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

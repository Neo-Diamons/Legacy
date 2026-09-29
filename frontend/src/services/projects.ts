import { authHeaders } from './authClient';

export interface ProjectResponse {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export function fetchProjects(): Promise<ProjectResponse[]> {
  return fetch('/projects', { headers: authHeaders() }).then((response) => parseOrThrow<ProjectResponse[]>(response));
}

export function createProject(input: { name: string; color: string }): Promise<ProjectResponse> {
  return fetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  }).then((response) => parseOrThrow<ProjectResponse>(response));
}

export function deleteProject(id: string): Promise<void> {
  return fetch(`/projects/${id}`, { method: 'DELETE', headers: authHeaders() }).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  });
}

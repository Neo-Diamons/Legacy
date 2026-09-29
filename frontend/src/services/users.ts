import { authFetch, readErrorMessage, type AuthUser } from './authClient';

export async function updateUser(id: string, input: { name: string }): Promise<AuthUser> {
  const response = await authFetch(`/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<AuthUser>;
}

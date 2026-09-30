import { authFetch, readErrorMessage, type AuthResponse, type AuthUser } from './authClient';

export async function updateUser(id: string, input: { name: string }): Promise<AuthUser> {
  const response = await authFetch(`/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<AuthUser>;
}

export async function changePassword(
  id: string,
  input: { currentPassword: string; newPassword: string }
): Promise<AuthResponse> {
  const response = await authFetch(`/users/${id}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 403) throw new Error('Le mot de passe actuel est incorrect.');
  if (response.status === 422) throw new Error('Le nouveau mot de passe doit contenir au moins 12 caractères.');
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<AuthResponse>;
}

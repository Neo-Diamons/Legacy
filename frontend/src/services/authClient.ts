export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  mustChangePassword?: boolean;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'legacy.auth.token';
const USER_KEY = 'legacy.auth.user';

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getStoredAuthUser(): AuthUser | null {
  const token = getAuthToken();
  const storedUser = localStorage.getItem(USER_KEY);
  if (!token || !storedUser) return null;
  if (isTokenExpired(token)) {
    clearAuthSession();
    return null;
  }
  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
}

function authErrorMessage(status: number, serverMessage?: string): string {
  if (status === 401) return 'Email ou mot de passe incorrect.';
  if (status === 409) return 'Cet email est déjà utilisé.';
  if (status === 422) return 'Données invalides : vérifiez l’email et utilisez un mot de passe de 12 caractères minimum.';
  return serverMessage ?? `Erreur ${status}`;
}

export async function readErrorMessage(response: Response): Promise<string> {
  const error = (await response.json().catch(() => null)) as { message?: string } | null;
  return error?.message ?? `${response.status} ${response.statusText}`;
}

export async function authenticate(path: string, body: Record<string, string>): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Impossible de joindre le serveur.');
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(authErrorMessage(response.status, error?.message));
  }
  return response.json() as Promise<AuthResponse>;
}

export function saveAuthSession(session: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  saveAuthUser(session.user);
}

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Registers a listener called when the session ends because the backend rejected the token. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function expireAuthSession(): void {
  clearAuthSession();
  for (const listener of unauthorizedListeners) listener();
}

/** fetch with the bearer token attached; a 401 (expired or invalid token) ends the session. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, { ...init, headers: { ...authHeaders(), ...(init.headers as Record<string, string>) } });
  if (response.status === 401) expireAuthSession();
  return response;
}

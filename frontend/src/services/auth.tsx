import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';
import {
  authenticate,
  clearAuthSession,
  getStoredAuthUser,
  onUnauthorized,
  refreshSession,
  saveAuthSession,
  saveAuthUser,
} from './authClient';
import { changePassword, updateUser } from './users';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(getStoredAuthUser);
  const [sessionKey, setSessionKey] = useState(0);

  // Back to the login page as soon as the backend rejects the token (expired, invalid...).
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const value: AuthContextValue = {
    user,
    sessionKey,
    loading: false,
    async login(email, password) {
      const session = await authenticate('/auth/login', { email, password });
      saveAuthSession(session);
      setUser(session.user);
    },
    async register(name, email, password) {
      const session = await authenticate('/auth/register', { name, email, password });
      saveAuthSession(session);
      setUser(session.user);
    },
    async updateName(name) {
      if (!user) return;
      const updated = await updateUser(user.id, { name });
      saveAuthUser(updated);
      setUser(updated);
    },
    async changePassword(currentPassword, newPassword) {
      if (!user) return;
      // The backend revokes the old token and answers with a new one, so the user stays signed in.
      const session = await refreshSession(async () => {
        const fresh = await changePassword(user.id, { currentPassword, newPassword });
        saveAuthSession(fresh);
        return fresh;
      });
      setUser(session.user);
      setSessionKey((key) => key + 1);
    },
    logout() {
      clearAuthSession();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';
import {
  authenticate,
  clearAuthSession,
  getStoredAuthUser,
  onUnauthorized,
  saveAuthSession,
  saveAuthUser,
} from './authClient';
import { updateUser } from './users';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(getStoredAuthUser);

  // Back to the login page as soon as the backend rejects the token (expired, invalid...).
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const value: AuthContextValue = {
    user,
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
    logout() {
      clearAuthSession();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

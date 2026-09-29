import { useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';
import { authenticate, clearAuthSession, getStoredAuthUser, saveAuthSession } from './authClient';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(getStoredAuthUser);
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
    logout() {
      clearAuthSession();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

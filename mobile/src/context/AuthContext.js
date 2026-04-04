import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('civik_token');
      if (storedToken) {
        const res = await client.get('/auth/me');
        setUser(res.data.user);
      }
    } catch {
      await SecureStore.deleteItemAsync('civik_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    if (!newToken || !newUser) {
      throw new Error('Invalid server response');
    }
    await SecureStore.setItemAsync('civik_token', newToken);
    setUser(newUser);
    return newUser;
  };

  const register = async (username, email, password) => {
    const res = await client.post('/auth/register', { username, email, password });
    const { token: newToken, user: newUser } = res.data;
    if (!newToken || !newUser) {
      throw new Error('Invalid server response');
    }
    await SecureStore.setItemAsync('civik_token', newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      // Clear local session even if the server-side cookie clear fails.
    }
    await SecureStore.deleteItemAsync('civik_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

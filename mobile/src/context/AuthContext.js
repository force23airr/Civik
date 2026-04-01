import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('dashguard_token');
      if (storedToken) {
        setToken(storedToken);
        const res = await client.get('/auth/me');
        setUser(res.data);
      }
    } catch {
      await SecureStore.deleteItemAsync('dashguard_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = res.data;
    await SecureStore.setItemAsync('dashguard_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const register = async (username, email, password) => {
    const res = await client.post('/auth/register', { username, email, password });
    const { token: newToken, user: newUser } = res.data;
    await SecureStore.setItemAsync('dashguard_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('dashguard_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

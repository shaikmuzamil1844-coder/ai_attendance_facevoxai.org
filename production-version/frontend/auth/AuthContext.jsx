// auth/AuthContext.jsx — JWT-based auth state
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/client';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(r  => setUser(r.data.user))
      .catch(() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken',  r.data.accessToken);
    localStorage.setItem('refreshToken', r.data.refreshToken);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

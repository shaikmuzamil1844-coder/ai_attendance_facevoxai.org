// services/client.js — Axios instance with JWT interceptors
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL: BASE, timeout: 30000 });

// Attach access token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      const refresh = localStorage.getItem('refreshToken');
      if (refresh) {
        try {
          const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken: refresh });
          localStorage.setItem('accessToken', r.data.accessToken);
          orig.headers.Authorization = `Bearer ${r.data.accessToken}`;
          return api(orig);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

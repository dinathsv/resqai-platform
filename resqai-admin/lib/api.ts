import axios from 'axios';
import Cookies from 'js-cookie';
import { AUTH_EVENT } from './auth-events';
import { disconnectSocket } from './socket';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
});

api.interceptors.request.use((config) => {
  let token = Cookies.get('admin_token');
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('admin_token') || undefined;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('admin_token', { path: '/' });
      disconnectSocket();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        window.dispatchEvent(new Event(AUTH_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

export default api;

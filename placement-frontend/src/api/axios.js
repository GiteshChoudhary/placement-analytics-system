import axios from 'axios';

// Dynamically resolve base API URL:
// 1. If explicit VITE_API_URL is provided, use it.
// 2. Otherwise default to relative path '/api' so requests automatically use
//    the current browser domain (localhost, LAN IP, or Localtunnel) and Vite proxies to :5000.
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    const raw = import.meta.env.VITE_API_URL;
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  return '/api';
};

// Create configured axios instance pointing to Express backend
const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Request interceptor: Attach JWT token from localStorage to every request
API.interceptors.request.use(
  (config) => {
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Bypass Localtunnel reminder splash screen on API requests
    config.headers['Bypass-Tunnel-Reminder'] = 'true';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle unauthorized/expired token globally
API.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} - Status: ${error.response?.status}`);
    if (error.response && error.response.status === 401) {
      // If unauthorized, clear local session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default API;

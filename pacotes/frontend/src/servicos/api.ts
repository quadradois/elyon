import axios from 'axios';

// Use environment variable or fallback to relative path for production
// Force relative path to use Nginx proxy
const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token e tenant
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('elyon_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Adicionar tenant ID do objeto salvo no login
  const tenantData = localStorage.getItem('elyon_tenant');
  if (tenantData) {
    try {
      const tenant = JSON.parse(tenantData);
      if (tenant?.id) {
        config.headers['X-Tenant-Id'] = tenant.id;
      }
    } catch (e) {
      console.error('[API] Erro ao parsear tenant:', e);
    }
  }

  return config;
});

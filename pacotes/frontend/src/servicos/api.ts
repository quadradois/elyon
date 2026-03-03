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
    config.headers['X-Access-Token'] = token;
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

// Interceptor global para tratamento de 401 (Não Autorizado) / Sessão Expirada
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Evita loop de redirecionamento se já estive na tela de login
      if (window.location.pathname !== '/login') {
        console.warn('[API] Sessão expirada ou não autorizada. Limpando credenciais...');

        // Limpar dados do localStorage
        localStorage.removeItem('elyon_token');
        localStorage.removeItem('elyon_usuario');
        localStorage.removeItem('elyon_tenant');

        // Disparar evento de logout para que contextos React se atualizem
        window.dispatchEvent(new Event('auth-logout'));

        // Redirecionamento forçado para a tela de login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

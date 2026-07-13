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

/**
 * Helper para verificar se um erro é de request cancelado/abortado.
 * Usado para evitar log de erros espúrios quando a página navega (ex: redirect 401).
 */
export function isRequestCanceled(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') return true;
    if (error.message === 'Request aborted') return true;
  }
  return false;
}

// Flag para evitar cascata de múltiplos redirects 401 simultâneos
let isRedirectingTo401 = false;

// Interceptor para adicionar token e tenant
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('elyon_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Interceptor global para tratamento de 401 (Não Autorizado) / Sessão Expirada
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignora requests cancelados (abortados por navegação ou cleanup de useEffect)
    if (isRequestCanceled(error)) {
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401) {
      // Evita loop de redirecionamento se já estiver na tela de login
      // E evita cascata: apenas o PRIMEIRO 401 dispara o redirect
      if (window.location.pathname !== '/login' && !isRedirectingTo401) {
        isRedirectingTo401 = true;
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

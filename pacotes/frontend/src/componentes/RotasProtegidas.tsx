import { Navigate } from 'react-router-dom';
import { WhatsAppProvider } from '../contextos/WhatsAppContext';

export function RotaPrivada({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('elyon_token');
  return token ? (
    <WhatsAppProvider>{children}</WhatsAppProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}

export function RotaAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('elyon_token');
  const usuario = JSON.parse(localStorage.getItem('elyon_usuario') || '{}');

  if (!token) return <Navigate to="/login" replace />;
  if (usuario.papel !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;

  return <WhatsAppProvider>{children}</WhatsAppProvider>;
}

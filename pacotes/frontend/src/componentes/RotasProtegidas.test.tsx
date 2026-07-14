import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RotaAdmin, RotaPrivada } from './RotasProtegidas';

vi.mock('../contextos/WhatsAppContext', () => ({
  WhatsAppProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function renderGuard(element: React.ReactNode, initialEntry = '/protegida') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route path="/dashboard" element={<div>Dashboard comum</div>} />
        <Route path="/protegida" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('guards de autenticacao', () => {
  it('redireciona uma sessao ausente para o login', () => {
    renderGuard(<RotaPrivada><div>Conteudo privado</div></RotaPrivada>);
    expect(screen.getByText('Tela de login')).toBeInTheDocument();
    expect(screen.queryByText('Conteudo privado')).not.toBeInTheDocument();
  });

  it('impede usuario comum de acessar rota administrativa', () => {
    localStorage.setItem('elyon_token', 'jwt-valido');
    localStorage.setItem('elyon_usuario', JSON.stringify({ papel: 'ADMIN' }));
    renderGuard(<RotaAdmin><div>Conteudo administrativo</div></RotaAdmin>);
    expect(screen.getByText('Dashboard comum')).toBeInTheDocument();
    expect(screen.queryByText('Conteudo administrativo')).not.toBeInTheDocument();
  });

  it('libera rota administrativa para SUPER_ADMIN', () => {
    localStorage.setItem('elyon_token', 'jwt-valido');
    localStorage.setItem('elyon_usuario', JSON.stringify({ papel: 'SUPER_ADMIN' }));
    renderGuard(<RotaAdmin><div>Conteudo administrativo</div></RotaAdmin>);
    expect(screen.getByText('Conteudo administrativo')).toBeInTheDocument();
  });
});

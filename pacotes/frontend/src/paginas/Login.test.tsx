import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../servicos/api';
import { Login } from './Login';

vi.mock('../servicos/api', () => ({
  api: { post: vi.fn() },
}));

const post = vi.mocked(api.post);

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>Dashboard autenticado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('fluxo de autenticacao', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('persiste a sessao e navega depois de um login valido', async () => {
    const usuario = userEvent.setup();
    post.mockResolvedValue({
      data: {
        token: 'jwt-integration',
        usuario: { id: 'usuario-1', papel: 'ADMIN' },
        tenant: { id: 'tenant-1' },
      },
    });
    renderLogin();

    await usuario.type(screen.getByLabelText('Email'), 'admin@elyon.test');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-segura');
    await usuario.click(screen.getByRole('button', { name: 'Entrar na Plataforma' }));

    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@elyon.test',
      senha: 'senha-segura',
    });
    expect(localStorage.getItem('elyon_token')).toBe('jwt-integration');
    expect(JSON.parse(localStorage.getItem('elyon_usuario') || '{}')).toMatchObject({ papel: 'ADMIN' });
    expect(await screen.findByText('Dashboard autenticado')).toBeInTheDocument();
  });

  it('exibe o erro da API sem criar sessao', async () => {
    const usuario = userEvent.setup();
    post.mockRejectedValue({ response: { data: { erro: 'Credenciais invalidas' } } });
    renderLogin();

    await usuario.type(screen.getByLabelText('Email'), 'invalido@elyon.test');
    await usuario.type(screen.getByLabelText('Senha'), 'incorreta');
    await usuario.click(screen.getByRole('button', { name: 'Entrar na Plataforma' }));

    expect(await screen.findByText('Credenciais invalidas')).toBeInTheDocument();
    expect(localStorage.getItem('elyon_token')).toBeNull();
  });
});

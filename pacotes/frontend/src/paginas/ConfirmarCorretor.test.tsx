import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../servicos/api';
import ConfirmarCorretor from './ConfirmarCorretor';

vi.mock('../servicos/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/confirmar-corretor/atividade-1/token-1']}>
      <Routes>
        <Route path="/confirmar-corretor/:atividadeId/:token" element={<ConfirmarCorretor />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('confirmação pública do especialista', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockResolvedValue({
      data: {
        leadNome: 'Ivonet',
        horario: '2026-08-03T12:00:00.000Z',
        statusConfirmacaoCorretor: 'PENDENTE',
      },
    });
  });

  it('substitui as ações por uma confirmação visual após o aceite', async () => {
    const usuario = userEvent.setup();
    post.mockResolvedValue({
      data: {
        sucesso: true,
        mensagem: 'Ligação confirmada e Lead notificado.',
        statusConfirmacaoCorretor: 'CONFIRMADO',
      },
    });
    renderPagina();

    await usuario.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('heading', { name: 'Atendimento confirmado' })).toBeInTheDocument();
    expect(screen.getByText('Ligação confirmada e Lead notificado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(screen.getByText('Você já pode fechar esta página')).toBeInTheDocument();
  });

  it('impede cliques repetidos enquanto a ação está em processamento', async () => {
    const usuario = userEvent.setup();
    let concluir!: (value: any) => void;
    post.mockImplementation(() => new Promise((resolve) => { concluir = resolve; }));
    renderPagina();

    const confirmar = await screen.findByRole('button', { name: 'Confirmar' });
    await usuario.click(confirmar);

    expect(screen.getByRole('button', { name: 'Confirmando' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ausência' })).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);

    concluir({ data: { sucesso: true, statusConfirmacaoCorretor: 'CONFIRMADO' } });
    expect(await screen.findByText('Você já pode fechar esta página')).toBeInTheDocument();
  });

  it('mostra o resultado de recusa e remove os botões', async () => {
    const usuario = userEvent.setup();
    post.mockResolvedValue({
      data: {
        sucesso: true,
        mensagem: 'Recusa registrada. Julia recebeu a solicitação de substituição.',
        statusConfirmacaoCorretor: 'PENDENTE',
      },
    });
    renderPagina();

    await usuario.click(await screen.findByRole('button', { name: 'Recusar' }));

    expect(await screen.findByRole('heading', { name: 'Recusa registrada' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument();
  });
});

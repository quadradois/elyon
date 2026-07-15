import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../servicos/api';
import { ChatPanel } from './ChatPanel';

vi.mock('../../servicos/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('ChatPanel - reagendamento real', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/followup/ativo')) return { data: { followup: {
        id: 'followup-ativo-123', mensagem: 'Mensagem existente', dataLocal: '2027-01-15T09:30',
        timezoneIana: 'America/Sao_Paulo', status: 'PENDENTE', reasonCode: null,
      } } } as never;
      if (url.endsWith('/chat')) return { data: { mensagens: [] } } as never;
      if (url.endsWith('/modo')) return { data: { modo: 'IA' } } as never;
      return { data: null } as never;
    });
    vi.mocked(api.post).mockResolvedValue({ data: { sucesso: true } } as never);
  });

  it('carrega o ativo, distingue reagendamento e envia seu followupId pela interacao da tela', async () => {
    render(<ChatPanel leadId="lead-123" leadNome="Lead" leadTelefone="5511999999999" />);
    fireEvent.click(screen.getByRole('button', { name: 'Follow-up' }));

    expect(await screen.findByText('Reagendar mensagem automática')).toBeInTheDocument();
    expect(screen.getByText(/Editando o agendamento ativo/)).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Mensagem existente'), { target: { value: 'Mensagem alterada pelo operador' } });
    fireEvent.change(screen.getByDisplayValue('2027-01-15T09:30'), { target: { value: '2027-01-20T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reagendar' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/leads/lead-123/followup', expect.objectContaining({
      followupId: 'followup-ativo-123', mensagem: 'Mensagem alterada pelo operador',
      dataEnvio: '2027-01-20 10:00', requestId: expect.any(String),
    })));
  });
});

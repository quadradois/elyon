import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { agendarFollowupManual } from './apiFollowup';

describe('contrato manual de follow-up', () => {
  afterEach(() => vi.restoreAllMocks());

  it('envia ao endpoint o corpo customizado, data/hora local e timezone IANA', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { sucesso: true } });
    await agendarFollowupManual('lead-123', {
      mensagem: ' Retorno personalizado combinado. ',
      dataLocal: '2027-01-15T09:30',
      timezoneIana: 'America/Sao_Paulo',
    });
    expect(post).toHaveBeenCalledWith('/leads/lead-123/followup', {
      mensagem: 'Retorno personalizado combinado.',
      dataEnvio: '2027-01-15 09:30',
      timezoneIana: 'America/Sao_Paulo',
      motivo: 'Agendamento manual pelo operador autenticado',
    });
  });

  it('envia followupId somente quando o operador pede reagendamento explicito', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { sucesso: true } });
    await agendarFollowupManual('lead-123', {
      mensagem: 'Novo texto confirmado.', dataLocal: '2027-01-20T10:00',
      timezoneIana: 'America/Sao_Paulo', followupId: 'followup-ativo-123',
    });
    expect(post).toHaveBeenCalledWith('/leads/lead-123/followup', expect.objectContaining({ followupId: 'followup-ativo-123' }));
  });
});

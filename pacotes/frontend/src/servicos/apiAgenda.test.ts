import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { agendaService } from './apiAgenda';

describe('contrato atomico da agenda manual', () => {
  afterEach(() => vi.restoreAllMocks());

  it('envia identidade confiavel e versao esperada no cancelamento', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { sucesso: true } });
    await agendaService.cancelarAgendamento('atividade-1', {
      motivo: 'Solicitado pelo Lead', avisarCliente: true,
      requestId: 'request-1', expectedVersion: 4,
    });
    expect(post).toHaveBeenCalledWith('/agenda/atividade-1/cancelar', {
      motivo: 'Solicitado pelo Lead', avisarCliente: true,
      requestId: 'request-1', expectedVersion: 4,
    });
  });

  it('envia nova agenda, identidade e versao no reagendamento', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { sucesso: true } });
    await agendaService.reagendarAgendamento('atividade-1', {
      novoHorario: new Date('2027-02-12T16:00:00Z'), motivo: 'Novo horario confirmado',
      avisarCliente: false, requestId: 'request-2', expectedVersion: 2,
    });
    expect(post).toHaveBeenCalledWith('/agenda/atividade-1/reagendar', {
      novoHorario: '2027-02-12T16:00:00.000Z', motivo: 'Novo horario confirmado',
      avisarCliente: false, requestId: 'request-2', expectedVersion: 2,
    });
  });
});

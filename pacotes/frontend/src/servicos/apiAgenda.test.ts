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

  it('preserva o especialista atual retornado pela agenda', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [{
      id: 'atividade-1',
      title: 'Atendimento agendado',
      start: '2026-08-01T18:00:00.000Z',
      end: '2026-08-01T19:00:00.000Z',
      allDay: false,
      extendedProps: {
        tipo: 'REUNIAO',
        status: 'CONFIRMADO',
        leadId: 'lead-1',
        leadNome: 'Ivonet',
        leadTelefone: '5562000000000',
        especialistaId: 'julia-1',
        especialistaNome: 'Julia Matos',
        statusConfirmacaoCorretor: 'CONFIRMADO',
        versao: 3,
      },
    }] });

    const eventos = await agendaService.listarEventos(
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-02T00:00:00.000Z'),
    );

    expect(eventos[0].extendedProps?.especialistaNome).toBe('Julia Matos');
    expect(eventos[0].extendedProps?.statusConfirmacaoCorretor).toBe('CONFIRMADO');
  });
});

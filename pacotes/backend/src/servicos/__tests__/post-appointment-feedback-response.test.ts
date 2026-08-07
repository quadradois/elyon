const mockCommand = jest.fn();
const mockPrisma: any = {
  feedbackPosAtendimentoAgenda: { updateMany: jest.fn() },
  atividade: { create: jest.fn() },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../observabilidade/agenda-comercial-metrics', () => ({
  registrarPostAppointmentFeedbackEvento: jest.fn(),
}));
jest.mock('../coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockCommand(...args),
}));

import { aplicarFeedbackPosAtendimento } from '../post-appointment-feedback-response';

const context = {
  feedbackId: 'f1', atividadeId: 'a1', leadId: 'l1', leadNome: 'Ivonet',
  tenantId: 't1', usuarioId: 'u1', agendadoPara: new Date('2026-08-05T15:00:00Z'),
  versaoAtividade: 3, status: 'AGUARDANDO_RESPOSTA',
};

describe('post appointment feedback response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCommand.mockResolvedValue({ success: true, reasonCode: 'REALIZED' });
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.atividade.create.mockResolvedValue({ id: 'nota1' });
  });

  it('registra atendimento realizado e cria nota append-only na ficha', async () => {
    const result = await aplicarFeedbackPosAtendimento({
      context,
      interpretation: { intent: 'REALIZADO', resumo: 'Conversei com a lead; quer vender em dois meses.' },
      providerEventId: 'wa-1',
      agora: new Date('2026-08-05T15:25:00Z'),
    });

    expect(result).toMatchObject({ success: true, reasonCode: 'FEEDBACK_REALIZADO' });
    expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'REALIZAR', atividadeId: 'a1', expectedVersion: 3,
    }));
    expect(mockPrisma.atividade.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      leadId: 'l1', tipo: 'NOTA', resultado: 'REALIZADO', mensagem: 'post-feedback:f1',
    }) });
    expect(mockPrisma.feedbackPosAtendimentoAgenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 't1', usuarioId: 'u1' }),
      data: expect.objectContaining({ status: 'CONCLUIDO', desfecho: 'REALIZADO' }),
    }));
  });

  it('distingue ausencia do especialista sem atribuir a falta ao lead', async () => {
    await aplicarFeedbackPosAtendimento({
      context,
      interpretation: { intent: 'ESPECIALISTA_AUSENTE', resumo: 'Eu não consegui realizar a ligação.' },
      providerEventId: 'wa-2',
    });
    expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'NO_SHOW', parteAusente: 'CORRETOR',
    }));
  });

  it('mantem reagendamento como pendencia operacional sem inventar novo horario', async () => {
    const result = await aplicarFeedbackPosAtendimento({
      context,
      interpretation: { intent: 'REAGENDAR', resumo: 'Preciso remarcar com a cliente.' },
      providerEventId: 'wa-3',
    });
    expect(result.reasonCode).toBe('FEEDBACK_REAGENDAR');
    expect(mockCommand).not.toHaveBeenCalled();
    expect(mockPrisma.feedbackPosAtendimentoAgenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDENCIA_GESTOR', desfecho: 'REAGENDAR' }),
    }));
  });

  it('trata resposta concorrente como replay sem duplicar a nota', async () => {
    mockCommand.mockResolvedValue({ success: false, reasonCode: 'COMMAND_REPLAY' });
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 0 });
    const result = await aplicarFeedbackPosAtendimento({
      context,
      interpretation: { intent: 'REALIZADO', resumo: 'Atendimento realizado.' },
      providerEventId: 'wa-replay',
    });
    expect(result).toMatchObject({ success: true, reasonCode: 'FEEDBACK_REPLAY' });
    expect(mockPrisma.atividade.create).not.toHaveBeenCalled();
  });
});

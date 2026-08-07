const mockPrisma: any = {
  atividade: { findMany: jest.fn() },
  usuario: { findFirst: jest.fn() },
  feedbackPosAtendimentoAgenda: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  efeitoAgendaOutbox: { create: jest.fn() },
  $transaction: jest.fn((callback: any) => callback(mockPrisma)),
};
const mockConfig = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/agenda-pilot-config', () => ({
  resolverAgendaPilotConfig: (...args: any[]) => mockConfig(...args),
}));
jest.mock('../../observabilidade/agenda-comercial-metrics', () => ({
  registrarPostAppointmentFeedbackEvento: jest.fn(),
}));

import { executarFeedbacksPosAtendimento } from '../job-post-appointment-feedback';

describe('job post appointment feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.atividade.findMany.mockResolvedValue([]);
    mockPrisma.feedbackPosAtendimentoAgenda.findMany.mockResolvedValue([]);
  });

  it('nao consulta nem envia quando o gate esta desligado', async () => {
    mockConfig.mockResolvedValue({ effects: { enabled: true }, postAppointmentFeedback: { enabled: false } });
    expect(await executarFeedbacksPosAtendimento()).toEqual({
      elegiveis: 0, enfileirados: 0, lembretes: 0, pendencias: 0, invalidados: 0, erros: 0,
    });
    expect(mockPrisma.atividade.findMany).not.toHaveBeenCalled();
  });

  it('enfileira uma unica solicitacao somente depois da elegibilidade', async () => {
    const agora = new Date('2026-08-05T15:20:00Z');
    mockConfig.mockResolvedValue({
      scope: { tenantId: 't1', startedAtUtc: '2026-08-01T00:00:00.000Z' },
      effects: { enabled: true }, postAppointmentFeedback: { enabled: true },
    });
    mockPrisma.atividade.findMany.mockResolvedValue([{
      id: 'a1', versao: 2, agendadoPara: new Date('2026-08-05T15:00:00Z'),
      duracao: 30, canal: 'LIGACAO', tipo: 'REUNIAO', corretorAtualId: 'u1',
      lead: { id: 'l1', nome: 'Ivonet', tenantId: 't1', nomeEdificio: 'Reserva Buriti',
        enderecoImovel: null, campanhaOrigem: null },
    }]);
    mockPrisma.usuario.findFirst.mockResolvedValue({ id: 'u1', nome: 'Guilherme' });
    mockPrisma.feedbackPosAtendimentoAgenda.create.mockResolvedValue({ id: 'f1' });
    mockPrisma.efeitoAgendaOutbox.create.mockResolvedValue({ id: 'o1' });

    const result = await executarFeedbacksPosAtendimento(agora);
    expect(result).toMatchObject({ elegiveis: 1, enfileirados: 1, erros: 0 });
    expect(mockPrisma.feedbackPosAtendimentoAgenda.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ atividadeId: 'a1', usuarioId: 'u1', status: 'AGUARDANDO_ENVIO' }),
    });
    expect(mockPrisma.efeitoAgendaOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'FEEDBACK_POS_ATENDIMENTO', destinatarioTipo: 'USUARIO' }),
    });
  });

  it('silencio por 24 horas gera pendencia, nunca no-show automatico', async () => {
    const agora = new Date('2026-08-06T16:00:00Z');
    mockConfig.mockResolvedValue({
      scope: { tenantId: 't1', startedAtUtc: '2026-08-01T00:00:00.000Z' },
      effects: { enabled: true }, postAppointmentFeedback: { enabled: true },
    });
    mockPrisma.feedbackPosAtendimentoAgenda.findMany.mockResolvedValue([{
      id: 'f1', tenantId: 't1', usuarioId: 'u1', versaoAtividade: 2,
      status: 'AGUARDANDO_RESPOSTA', expiraEm: new Date('2026-08-06T15:00:00Z'),
      lembreteEm: null, enviadoEm: new Date('2026-08-05T15:00:00Z'),
      atividade: { id: 'a1', versao: 2, statusAgendamento: 'CONFIRMADO', corretorAtualId: 'u1',
        lead: { id: 'l1', nome: 'Ivonet', tenantId: 't1' } },
    }]);
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 1 });

    const result = await executarFeedbacksPosAtendimento(agora);
    expect(result.pendencias).toBe(1);
    expect(mockPrisma.feedbackPosAtendimentoAgenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'PENDENCIA_GESTOR' },
    }));
  });

  it('enfileira somente um lembrete duas horas depois do envio efetivo', async () => {
    const agora = new Date('2026-08-05T17:01:00Z');
    mockConfig.mockResolvedValue({
      scope: { tenantId: 't1', startedAtUtc: '2026-08-01T00:00:00.000Z' },
      effects: { enabled: true }, postAppointmentFeedback: { enabled: true },
    });
    mockPrisma.feedbackPosAtendimentoAgenda.findMany.mockResolvedValue([{
      id: 'f1', tenantId: 't1', usuarioId: 'u1', versaoAtividade: 2,
      status: 'AGUARDANDO_RESPOSTA', expiraEm: new Date('2026-08-06T15:00:00Z'),
      lembreteEm: null, enviadoEm: new Date('2026-08-05T15:00:00Z'),
      atividade: { id: 'a1', versao: 2, statusAgendamento: 'CONFIRMADO', corretorAtualId: 'u1',
        lead: { id: 'l1', nome: 'Ivonet', tenantId: 't1' } },
    }]);
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.efeitoAgendaOutbox.create.mockResolvedValue({ id: 'out-reminder' });

    const result = await executarFeedbacksPosAtendimento(agora);
    expect(result.lembretes).toBe(1);
    expect(mockPrisma.efeitoAgendaOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tipo: 'LEMBRETE_FEEDBACK_POS_ATENDIMENTO', usuarioDestinoId: 'u1',
    }) });
  });

  it('invalida feedback quando o compromisso ou responsavel mudou', async () => {
    const agora = new Date('2026-08-05T17:01:00Z');
    mockConfig.mockResolvedValue({
      scope: { tenantId: 't1', startedAtUtc: '2026-08-01T00:00:00.000Z' },
      effects: { enabled: true }, postAppointmentFeedback: { enabled: true },
    });
    mockPrisma.feedbackPosAtendimentoAgenda.findMany.mockResolvedValue([{
      id: 'f1', tenantId: 't1', usuarioId: 'u1', versaoAtividade: 2,
      status: 'AGUARDANDO_RESPOSTA', expiraEm: new Date('2026-08-06T15:00:00Z'),
      lembreteEm: null, enviadoEm: new Date('2026-08-05T15:00:00Z'),
      atividade: { id: 'a1', versao: 3, statusAgendamento: 'CONFIRMADO', corretorAtualId: 'u2',
        lead: { id: 'l1', nome: 'Ivonet', tenantId: 't1' } },
    }]);
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 1 });

    const result = await executarFeedbacksPosAtendimento(agora);
    expect(result.invalidados).toBe(1);
    expect(mockPrisma.feedbackPosAtendimentoAgenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'INVALIDADO' },
    }));
    expect(mockPrisma.efeitoAgendaOutbox.create).not.toHaveBeenCalled();
  });
});

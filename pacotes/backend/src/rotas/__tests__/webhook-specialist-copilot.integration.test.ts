const mockPrisma: any = {
  interacaoEspecialistaAgenda: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
};
const mockRollout = jest.fn();
const mockResolve = jest.fn();
const mockInvites = jest.fn();
const mockDecision = jest.fn();
const mockFeedbacks = jest.fn();
const mockApplyFeedback = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/agenda-lifecycle-rollout', () => ({ obterSpecialistCopilotRollout: (...args: any[]) => mockRollout(...args) }));
jest.mock('../../servicos/specialist-copilot-context', () => ({
  resolverEspecialistaPorTelefone: (...args: any[]) => mockResolve(...args),
  buscarConvitesAcionaveis: (...args: any[]) => mockInvites(...args),
  buscarFeedbacksPosAtendimentoAcionaveis: (...args: any[]) => mockFeedbacks(...args),
  buscarCompromissosConfirmadosEspecialista: jest.fn(),
  descreverFeedbacksParaDesambiguacao: jest.fn(() => 'Escolha um atendimento'),
  descreverConvitesParaDesambiguacao: jest.fn(() => 'Escolha uma solicitação'),
}));
jest.mock('../../servicos/specialist-appointment-decision', () => ({ executarDecisaoEspecialista: (...args: any[]) => mockDecision(...args) }));
jest.mock('../../servicos/post-appointment-feedback-response', () => ({
  aplicarFeedbackPosAtendimento: (...args: any[]) => mockApplyFeedback(...args),
}));
jest.mock('../../observabilidade/agenda-comercial-metrics', () => ({ registrarSpecialistCopilotEvento: jest.fn() }));

import { processarInboundEspecialista } from '../../servicos/specialist-copilot';

describe('webhook specialist copilot routing', () => {
  const context = {
    conviteId: 'c1', atividadeId: 'a1', usuarioId: 'u1', tenantId: 't1', tentativa: 1,
    prazoEm: new Date('2026-08-04T18:00:00Z'), leadId: 'l1', leadNome: 'Ivonet',
    agendadoPara: new Date('2026-08-04T15:00:00Z'), versaoAtividade: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRollout.mockResolvedValue({ enabled: true, reason: 'ENABLED' });
    mockResolve.mockResolvedValue({ id: 'u1', tenantId: 't1', nome: 'Guilherme', telefone: '62999990001' });
    mockInvites.mockResolvedValue([context]);
    mockFeedbacks.mockResolvedValue([]);
    mockPrisma.interacaoEspecialistaAgenda.findUnique.mockResolvedValue(null);
    mockPrisma.interacaoEspecialistaAgenda.create.mockResolvedValue({ id: 'i1' });
    mockPrisma.interacaoEspecialistaAgenda.update.mockResolvedValue({});
  });

  it('não intercepta remetente não identificado no tenant', async () => {
    mockResolve.mockResolvedValue(null);
    await expect(processarInboundEspecialista({
      tenantId: 't1', telefone: '62900000000', texto: 'confirmo', providerEventId: 'm1',
    })).resolves.toEqual({ handled: false, reason: 'SPECIALIST_NOT_RESOLVED' });
    expect(mockDecision).not.toHaveBeenCalled();
  });

  it.each([
    ['confirmo', 'CONFIRMAR'],
    ['não consigo', 'RECUSAR'],
  ])('roteia %s para decisão determinística %s', async (texto, decision) => {
    mockDecision.mockResolvedValue({ success: true, reasonCode: 'OK', message: 'Registrado' });
    const result = await processarInboundEspecialista({
      tenantId: 't1', telefone: '62999990001', texto, providerEventId: `m-${decision}`,
      agora: new Date('2026-08-03T18:00:00Z'),
    });
    expect(result).toMatchObject({ handled: true, response: 'Registrado' });
    expect(mockDecision).toHaveBeenCalledWith(expect.objectContaining({ context, decision }));
  });

  it('roteia o resultado pos-atendimento antes dos convites futuros', async () => {
    const feedback = {
      feedbackId: 'f1', atividadeId: 'a-passada', usuarioId: 'u1', tenantId: 't1',
      leadId: 'l1', leadNome: 'Ivonet', agendadoPara: new Date('2026-08-04T15:00:00Z'),
      versaoAtividade: 2, status: 'AGUARDANDO_RESPOSTA',
    };
    mockFeedbacks.mockResolvedValue([feedback]);
    mockApplyFeedback.mockResolvedValue({ success: true, reasonCode: 'FEEDBACK_REALIZADO', message: 'Ficha atualizada.' });

    const result = await processarInboundEspecialista({
      tenantId: 't1', telefone: '62999990001', texto: 'Atendimento realizado, quer vender.',
      providerEventId: 'feedback-1', agora: new Date('2026-08-04T15:25:00Z'),
    });

    expect(result).toEqual({ handled: true, reason: 'FEEDBACK_REALIZADO', response: 'Ficha atualizada.' });
    expect(mockApplyFeedback).toHaveBeenCalledWith(expect.objectContaining({ context: feedback }));
    expect(mockDecision).not.toHaveBeenCalled();
  });

  it('nao reaplica webhook de feedback ja processado', async () => {
    mockPrisma.interacaoEspecialistaAgenda.findUnique.mockResolvedValue({ resultado: 'FEEDBACK_REALIZADO' });
    const result = await processarInboundEspecialista({
      tenantId: 't1', telefone: '62999990001', texto: 'realizado', providerEventId: 'feedback-replay',
    });
    expect(result).toEqual({ handled: true, reason: 'EVENT_REPLAY' });
    expect(mockApplyFeedback).not.toHaveBeenCalled();
  });
});

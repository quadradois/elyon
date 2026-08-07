const mockCommand = jest.fn();
const mockPrisma: any = {
  atividade: { findMany: jest.fn(), findFirst: jest.fn() },
  contrapropostaAgenda: { findMany: jest.fn(), updateMany: jest.fn() },
  conviteEspecialistaAgenda: { updateMany: jest.fn() },
  $transaction: jest.fn((ops: any) => Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)),
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockCommand(...args),
}));

import { processarRespostaLeadContraproposta } from '../specialist-counterproposal';

describe('specialist counterproposal acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.contrapropostaAgenda.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.conviteEspecialistaAgenda.updateMany.mockResolvedValue({ count: 1 });
  });

  it('mantém o compromisso ao recusar a proposta', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([{ id: 'a1' }]);
    mockPrisma.contrapropostaAgenda.findMany.mockResolvedValue([{ id: 'p1' }]);
    const result = await processarRespostaLeadContraproposta({
      tenantId: 't1', leadId: 'l1', texto: 'não funciona', providerEventId: 'm1',
    });
    expect(result.reasonCode).toBe('COUNTERPROPOSAL_DECLINED');
    expect(mockCommand).not.toHaveBeenCalled();
  });

  it('revalida e confirma o responsável somente após aceite explícito', async () => {
    const horario = new Date('2026-08-04T15:00:00Z');
    mockPrisma.atividade.findMany
      .mockResolvedValueOnce([{ id: 'a1' }])
      .mockResolvedValueOnce([]);
    mockPrisma.contrapropostaAgenda.findMany.mockResolvedValue([{
      id: 'p1', atividadeId: 'a1', horarioProposto: horario, versaoAtividadeOrigem: 2,
    }]);
    mockPrisma.atividade.findFirst.mockResolvedValue({
      id: 'a1', leadId: 'l1', versao: 2, corretorAtualId: 'u1', duracao: 30, lead: { nome: 'Ivonet' },
    });
    mockCommand.mockResolvedValue({ success: true, reasonCode: 'RESCHEDULED', atividadeResultanteId: 'a2' });
    const result = await processarRespostaLeadContraproposta({
      tenantId: 't1', leadId: 'l1', texto: 'sim', providerEventId: 'm2',
    });
    expect(result.handled).toBe(true);
    expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'REAGENDAR', novoHorario: horario, responsavelId: 'u1', confirmarResponsavel: true,
    }));
  });
});

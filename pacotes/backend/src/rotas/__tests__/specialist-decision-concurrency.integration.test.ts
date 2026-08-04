const mockPrisma: any = {
  atividade: { findFirst: jest.fn() },
  conviteEspecialistaAgenda: { findFirst: jest.fn(), updateMany: jest.fn() },
  usuario: { findUnique: jest.fn() },
};
const mockCommand = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockCommand(...args),
}));
jest.mock('../../servicos/agenda-lifecycle-rollout', () => ({ obterAgendaEffectsRollout: jest.fn(async () => ({ effectsEnabled: true })) }));
jest.mock('../../servicos/remanejamento-corretor', () => ({ remanejarCorretorAtividade: jest.fn() }));

import { executarDecisaoEspecialista } from '../../servicos/specialist-appointment-decision';

describe('specialist decision concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.atividade.findFirst.mockResolvedValue({
      id: 'a1', versao: 2, agendadoPara: new Date('2026-08-04T15:00:00Z'),
      lead: { id: 'l1', nome: 'Ivonet', telefone: '62999990002', tenantId: 't1' },
    });
    mockPrisma.conviteEspecialistaAgenda.findFirst.mockResolvedValue({
      id: 'c1', prazoEm: new Date('2026-08-04T14:00:00Z'),
    });
    mockPrisma.conviteEspecialistaAgenda.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.usuario.findUnique.mockResolvedValue({ nome: 'Guilherme' });
  });

  it('só reconhece sucesso para uma decisão quando a outra fica obsoleta', async () => {
    mockCommand
      .mockResolvedValueOnce({ success: true, reasonCode: 'ASSIGNMENT_CONFIRMED' })
      .mockResolvedValueOnce({ success: false, reasonCode: 'STALE_EVENT' });
    const context = {
      conviteId: 'c1', atividadeId: 'a1', usuarioId: 'u1', tenantId: 't1', tentativa: 1,
      prazoEm: new Date('2026-08-04T14:00:00Z'), leadId: 'l1', leadNome: 'Ivonet',
      agendadoPara: new Date('2026-08-04T15:00:00Z'), versaoAtividade: 2,
    };
    const [whatsapp, link] = await Promise.all([
      executarDecisaoEspecialista({ context, decision: 'CONFIRMAR', providerEventId: 'wa-1', channel: 'WHATSAPP', ocorreuEm: new Date('2026-08-03T18:00:00Z') }),
      executarDecisaoEspecialista({ context, decision: 'CONFIRMAR', providerEventId: 'link-1', channel: 'LINK_PUBLICO', ocorreuEm: new Date('2026-08-03T18:00:00Z') }),
    ]);
    expect([whatsapp.success, link.success].filter(Boolean)).toHaveLength(1);
    expect([whatsapp.reasonCode, link.reasonCode]).toContain('STALE_EVENT');
    expect(mockPrisma.conviteEspecialistaAgenda.updateMany).toHaveBeenCalledTimes(1);
  });
});

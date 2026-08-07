const effect = {
  id: 'out1', tenantId: 't1', leadId: 'l1', atividadeId: 'a1',
  destinatarioTipo: 'USUARIO', usuarioDestinoId: 'u1', tipo: 'FEEDBACK_POS_ATENDIMENTO',
  mensagem: 'Como foi?', chaveIdempotencia: 'idem-1', fencingToken: 1,
};
const mockPrisma: any = {
  tenant: { findFirst: jest.fn() },
  efeitoAgendaOutbox: { updateMany: jest.fn(), update: jest.fn() },
  feedbackPosAtendimentoAgenda: { updateMany: jest.fn() },
  usuario: { findFirst: jest.fn() },
  lead: { findFirst: jest.fn() },
  sessaoWhatsapp: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
};
mockPrisma.$transaction = jest.fn((callback: any) => callback(mockPrisma));

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('../../observabilidade/agenda-comercial-metrics', () => ({
  agendaEfeitosEventos: { inc: jest.fn() },
}));

import { executarProximoEfeitoAgenda } from '../efeitos-agenda-outbox';

describe('delivery do feedback pos-atendimento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.tenant.findFirst.mockResolvedValue({ id: 't1' });
    mockPrisma.efeitoAgendaOutbox.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'out1' }]);
    mockPrisma.efeitoAgendaOutbox.update.mockResolvedValue(effect);
    mockPrisma.usuario.findFirst.mockResolvedValue({ telefone: '5562999990001' });
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue({ instanceName: 'elyon' });
    mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mockResolvedValue({ count: 1 });
  });

  it('inicia o SLA apenas depois da confirmacao do provedor', async () => {
    const agora = new Date('2026-08-05T15:20:00Z');
    const sender = { send: jest.fn().mockResolvedValue({ providerId: 'wa-out-1' }) };

    await expect(executarProximoEfeitoAgenda({
      tenantId: 't1', startedAtUtc: '2026-08-01T00:00:00.000Z',
    }, 'worker-1', sender, agora)).resolves.toBe(true);

    expect(sender.send).toHaveBeenCalledWith('elyon', '5562999990001', 'Como foi?', 'idem-1');
    expect(mockPrisma.feedbackPosAtendimentoAgenda.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', atividadeId: 'a1', usuarioId: 'u1', status: 'AGUARDANDO_ENVIO' },
      data: expect.objectContaining({
        status: 'AGUARDANDO_RESPOSTA', enviadoEm: expect.any(Date), expiraEm: expect.any(Date),
        providerMessageId: 'wa-out-1',
      }),
    });
    const data = mockPrisma.feedbackPosAtendimentoAgenda.updateMany.mock.calls[0][0].data;
    expect(data.expiraEm.getTime() - data.enviadoEm.getTime()).toBe(24 * 60 * 60_000);
  });
});

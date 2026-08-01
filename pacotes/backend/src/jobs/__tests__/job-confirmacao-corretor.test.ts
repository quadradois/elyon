const mockPrisma = {
  atividade: { findMany: jest.fn(), update: jest.fn() },
  sessaoWhatsapp: { findFirst: jest.fn() },
  usuario: { findFirst: jest.fn() },
};

const mockWhatsapp = { enviarMensagemTexto: jest.fn() };
const mockResolver = jest.fn();
const mockRemanejar = jest.fn();
const mockAuditoria = { registrar: jest.fn() };

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/whatsapp', () => ({ getWhatsAppService: () => mockWhatsapp }));
jest.mock('../../servicos/resolucao-especialista-campanha', () => ({ resolverEspecialistaCampanha: (...args: any[]) => mockResolver(...args) }));
jest.mock('../../servicos/remanejamento-corretor', () => ({ remanejarCorretorAtividade: (...args: any[]) => mockRemanejar(...args) }));
jest.mock('../../servicos/servico-auditoria', () => ({ ServicoAuditoria: mockAuditoria }));

import {
  executarConvitesConfirmacaoCorretor,
  executarCutoffRemanejamentoCorretor,
  executarLembretesConfirmacaoCorretor,
} from '../job-confirmacao-corretor';

describe('job-confirmacao-corretor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemanejar.mockResolvedValue({ sucesso: true, motivo: 'REMANEJADO' });
  });

  it('expira e remaneja reunião pendente', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([
      {
        id: 'a1',
        agendadoPara: new Date('2026-04-29T16:00:00Z'),
        lead: { id: 'l1', nome: 'Lead 1', tenantId: 't1', campanhaOrigemId: 'c1', telefone: '11999999999' }
      }
    ]);
    mockResolver.mockResolvedValue({ nome: 'Especialista', cargo: 'Corretor Especialista', telefone: '11988888888', usuarioId: 'u1', origem: 'FALLBACK_CAMPANHA' });
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue({ instanceName: 'inst1' });

    const out = await executarCutoffRemanejamentoCorretor();

    expect(out.processados).toBe(1);
    expect(out.expirados).toBe(1);
    expect(out.remanejados).toBe(1);
    expect(mockPrisma.atividade.update).toHaveBeenCalledTimes(1);
    expect(mockRemanejar).toHaveBeenCalledWith({ atividadeId: 'a1', origem: 'CUTOFF' });
    expect(mockPrisma.atividade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        statusConfirmacaoCorretor: { in: ['PENDENTE', 'RECUSADO'] },
        agendadoPara: expect.objectContaining({ gt: expect.any(Date), lte: expect.any(Date) }),
      }),
    }));
  });

  it('não reenvia lembrete quando já enviado (idempotência)', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([]);

    const out = await executarLembretesConfirmacaoCorretor();

    expect(out.processados).toBe(0);
    expect(out.enviados).toBe(0);
    expect(mockWhatsapp.enviarMensagemTexto).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
        statusConfirmacaoCorretor: 'PENDENTE',
      }),
    }));
  });

  it('recupera convite não enviado entre T-120 e T-60', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([]);

    await executarConvitesConfirmacaoCorretor();

    const chamada = mockPrisma.atividade.findMany.mock.calls[0][0];
    const janela = chamada.where.agendadoPara;
    expect(janela.gt).toBeInstanceOf(Date);
    expect(janela.lte).toBeInstanceOf(Date);
    expect(janela.lte.getTime() - janela.gt.getTime()).toBe(60 * 60 * 1000);
    expect(chamada.where.confirmacaoCorretorSolicitadaEm).toBeNull();
  });

  it('envia convite ao especialista atual da atividade após remanejamento', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([{
      id: 'a-remanejada',
      tokenConfirmacaoCorretor: 'token-novo',
      agendadoPara: new Date('2026-08-01T18:00:00Z'),
      corretorAtualId: 'u-julia',
      lead: { id: 'l1', nome: 'Ivonet', tenantId: 't1', campanhaOrigemId: 'c1' },
    }]);
    mockPrisma.usuario.findFirst.mockResolvedValue({
      id: 'u-julia', nome: 'Julia', telefone: '+55 62 8591-9018', email: null, papel: 'CORRETOR',
    });
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue({ instanceName: 'inst1' });

    const out = await executarConvitesConfirmacaoCorretor();

    expect(out.enviados).toBe(1);
    expect(mockResolver).not.toHaveBeenCalled();
    expect(mockWhatsapp.enviarMensagemTexto).toHaveBeenCalledWith(
      '556285919018',
      expect.stringContaining('/confirmar-corretor/a-remanejada/token-novo'),
    );
  });
});

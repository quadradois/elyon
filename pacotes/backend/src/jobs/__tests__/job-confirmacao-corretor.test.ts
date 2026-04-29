const mockPrisma = {
  atividade: { findMany: jest.fn(), update: jest.fn() },
  sessaoWhatsapp: { findFirst: jest.fn() },
};

const mockWhatsapp = { enviarMensagemTexto: jest.fn() };
const mockResolver = jest.fn();
const mockAuditoria = { registrar: jest.fn() };

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../servicos/whatsapp', () => ({ getWhatsAppService: () => mockWhatsapp }));
jest.mock('../../servicos/resolucao-especialista-campanha', () => ({ resolverEspecialistaCampanha: (...args: any[]) => mockResolver(...args) }));
jest.mock('../../servicos/servico-auditoria', () => ({ ServicoAuditoria: mockAuditoria }));

import {
  executarCutoffRemanejamentoCorretor,
  executarLembretesConfirmacaoCorretor,
} from '../job-confirmacao-corretor';

describe('job-confirmacao-corretor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(mockPrisma.atividade.update).toHaveBeenCalledTimes(2);
    expect(mockWhatsapp.enviarMensagemTexto).toHaveBeenCalled();
  });

  it('não reenvia lembrete quando já enviado (idempotência)', async () => {
    mockPrisma.atividade.findMany.mockResolvedValue([]);

    const out = await executarLembretesConfirmacaoCorretor();

    expect(out.processados).toBe(0);
    expect(out.enviados).toBe(0);
    expect(mockWhatsapp.enviarMensagemTexto).not.toHaveBeenCalled();
  });
});

const mockPrisma = {
  atividade: { findMany: jest.fn(), update: jest.fn() },
  sessaoWhatsapp: { findFirst: jest.fn() },
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
  executarLembretesConfirmacaoCorretor,
  executarCutoffRemanejamentoCorretor,
} from '../job-confirmacao-corretor';

describe('fluxo integração confirmação corretor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolver.mockResolvedValue({
      nome: 'Especialista',
      cargo: 'Corretor Especialista',
      telefone: '11988888888',
      usuarioId: 'u1',
      origem: 'RESPONSAVEL_CAMPANHA'
    });
    mockRemanejar.mockResolvedValue({ sucesso: true, motivo: 'REMANEJADO' });
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue({ instanceName: 'inst1' });
  });

  it('executa convite -> lembrete -> cutoff/remanejamento', async () => {
    mockPrisma.atividade.findMany
      .mockResolvedValueOnce([
        {
          id: 'a1',
          tokenConfirmacaoCorretor: 'tok',
          agendadoPara: new Date('2026-04-29T16:00:00Z'),
          lead: { id: 'l1', nome: 'Lead 1', tenantId: 't1', campanhaOrigemId: 'c1', telefone: '11999999999' }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'a1',
          tokenConfirmacaoCorretor: 'tok',
          agendadoPara: new Date('2026-04-29T16:00:00Z'),
          lead: { id: 'l1', nome: 'Lead 1', tenantId: 't1', campanhaOrigemId: 'c1', telefone: '11999999999' }
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'a1',
          tokenConfirmacaoCorretor: 'tok',
          agendadoPara: new Date('2026-04-29T16:00:00Z'),
          lead: { id: 'l1', nome: 'Lead 1', tenantId: 't1', campanhaOrigemId: 'c1', telefone: '11999999999' }
        }
      ]);

    const convite = await executarConvitesConfirmacaoCorretor();
    const lembrete = await executarLembretesConfirmacaoCorretor();
    const cutoff = await executarCutoffRemanejamentoCorretor();

    expect(convite.enviados).toBe(1);
    expect(lembrete.enviados).toBe(1);
    expect(cutoff.remanejados).toBe(1);
    expect(mockWhatsapp.enviarMensagemTexto).toHaveBeenCalled();
  });
});

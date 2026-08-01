const mockPrisma = {
  atividade: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  sessaoWhatsapp: { findFirst: jest.fn() },
};
const mockResolver = jest.fn();
const mockWhatsapp = { enviarMensagemTexto: jest.fn() };
const mockAuditoria = { registrar: jest.fn() };

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../resolucao-especialista-campanha', () => ({
  resolverEspecialistaCampanha: (...args: any[]) => mockResolver(...args),
}));
jest.mock('../whatsapp', () => ({ getWhatsAppService: () => mockWhatsapp }));
jest.mock('../servico-auditoria', () => ({ ServicoAuditoria: mockAuditoria }));

import { remanejarCorretorAtividade } from '../remanejamento-corretor';

describe('remanejarCorretorAtividade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.atividade.findUnique.mockResolvedValue({
      id: 'a1',
      tipo: 'REUNIAO',
      versao: 3,
      agendadoPara: new Date('2026-08-03T13:00:00Z'),
      statusAgendamento: 'CONFIRMADO',
      statusConfirmacaoCorretor: 'RECUSADO',
      corretorOriginalId: 'u1',
      corretorAtualId: 'u1',
      lead: {
        id: 'l1', nome: 'Ivonet', telefone: '62999999999', tenantId: 't1', campanhaOrigemId: 'c1',
      },
    });
    mockPrisma.atividade.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue(null);
    mockResolver.mockResolvedValue({
      nome: 'Eloisa', telefone: '62988888888', usuarioId: 'u2', origem: 'POOL_TENANT', cargo: 'Corretor Especialista',
    });
  });

  it('exclui o recusante, gera novo ciclo pendente e preserva o horário', async () => {
    const resultado = await remanejarCorretorAtividade({ atividadeId: 'a1', origem: 'RECUSA_EXPLICITA' });

    expect(resultado).toMatchObject({ sucesso: true, motivo: 'REMANEJADO', especialistaId: 'u2' });
    expect(mockResolver).toHaveBeenCalledWith(expect.objectContaining({ excluirUsuarioIds: ['u1'] }));
    expect(mockPrisma.atividade.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'a1', versao: 3, statusConfirmacaoCorretor: { in: ['RECUSADO', 'EXPIRADO'] } }),
      data: expect.objectContaining({
        statusConfirmacaoCorretor: 'PENDENTE',
        corretorOriginalId: 'u1',
        corretorAtualId: 'u2',
        tokenConfirmacaoCorretor: expect.any(String),
      }),
    }));
  });

  it('não recoloca o recusante quando não existe substituto', async () => {
    mockResolver.mockResolvedValue(null);

    const resultado = await remanejarCorretorAtividade({ atividadeId: 'a1', origem: 'RECUSA_EXPLICITA' });

    expect(resultado).toEqual({ sucesso: false, motivo: 'SEM_SUBSTITUTO' });
    expect(mockPrisma.atividade.updateMany).not.toHaveBeenCalled();
  });
});

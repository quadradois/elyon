// Mock do prisma ANTES do import
jest.mock('../../lib/db', () => ({
  prisma: {
    contrato: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    conversa: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mensagem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    comandoAgendaLedger: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    milestoneAgenda: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    atividade: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    cliente: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    imovel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    lead: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  },
}));

import { cascadeDeleteLeads } from '../../utils/cascade-delete';
import { prisma } from '../../lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('cascadeDeleteLeads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna sem chamar nada para array vazio', async () => {
    await cascadeDeleteLeads([]);

    expect(mockPrisma.contrato.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.lead.deleteMany).not.toHaveBeenCalled();
  });

  it('executa toda a cadeia para array com leads', async () => {
    const ids = ['lead-1', 'lead-2'];

    await cascadeDeleteLeads(ids);

    // Verifica ordem e argumentos
    expect(mockPrisma.contrato.deleteMany).toHaveBeenCalledWith({
      where: { leadId: { in: ids } },
    });

    expect(mockPrisma.conversa.findMany).toHaveBeenCalledWith({
      where: { leadId: { in: ids } },
      select: { id: true },
    });

    expect(mockPrisma.conversa.deleteMany).toHaveBeenCalledWith({
      where: { leadId: { in: ids } },
    });

    expect(mockPrisma.comandoAgendaLedger.deleteMany).toHaveBeenCalledWith({ where: { leadId: { in: ids } } });
    expect(mockPrisma.milestoneAgenda.deleteMany).toHaveBeenCalledWith({ where: { leadId: { in: ids } } });

    expect(mockPrisma.atividade.deleteMany).toHaveBeenCalledWith({
      where: { leadId: { in: ids } },
    });

    expect(mockPrisma.cliente.updateMany).toHaveBeenCalledWith({
      where: { origemLeadId: { in: ids } },
      data: { origemLeadId: null },
    });

    expect(mockPrisma.imovel.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ids } },
      data: { leadId: null },
    });

    expect(mockPrisma.lead.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ids } },
    });
  });

  it('deleta mensagens quando há conversas', async () => {
    const ids = ['lead-1'];
    const conversasMock = [{ id: 'conv-1' }, { id: 'conv-2' }];

    (mockPrisma.conversa.findMany as jest.Mock).mockResolvedValueOnce(conversasMock);

    await cascadeDeleteLeads(ids);

    expect(mockPrisma.mensagem.deleteMany).toHaveBeenCalledWith({
      where: { conversaId: { in: ['conv-1', 'conv-2'] } },
    });
  });

  it('NÃO deleta mensagens quando não há conversas', async () => {
    const ids = ['lead-1'];
    (mockPrisma.conversa.findMany as jest.Mock).mockResolvedValueOnce([]);

    await cascadeDeleteLeads(ids);

    expect(mockPrisma.mensagem.deleteMany).not.toHaveBeenCalled();
  });

  it('executa operações na ordem correta', async () => {
    const callOrder: string[] = [];

    (mockPrisma.contrato.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('contrato');
      return { count: 0 };
    });
    (mockPrisma.conversa.findMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('conversa.find');
      return [];
    });
    (mockPrisma.conversa.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('conversa.delete');
      return { count: 0 };
    });
    (mockPrisma.atividade.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('atividade');
      return { count: 0 };
    });
    (mockPrisma.comandoAgendaLedger.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('agenda.ledger');
      return { count: 0 };
    });
    (mockPrisma.milestoneAgenda.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('agenda.milestone');
      return { count: 0 };
    });
    (mockPrisma.cliente.updateMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('cliente');
      return { count: 0 };
    });
    (mockPrisma.imovel.updateMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('imovel');
      return { count: 0 };
    });
    (mockPrisma.lead.deleteMany as jest.Mock).mockImplementation(async () => {
      callOrder.push('lead');
      return { count: 0 };
    });

    await cascadeDeleteLeads(['lead-1']);

    expect(callOrder).toEqual([
      'contrato',
      'conversa.find',
      'conversa.delete',
      'agenda.ledger',
      'agenda.milestone',
      'atividade',
      'cliente',
      'imovel',
      'lead',
    ]);
  });
});

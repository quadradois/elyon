const mockPrisma = {
  conversa: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  mensagem: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  conversaEmbedding: {
    deleteMany: jest.fn(),
  },
  lead: {
    update: jest.fn(),
  },
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));

import { aplicarRetencaoSeguraLead } from '../../utils/retencao-segura';

describe('aplicarRetencaoSeguraLead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RETENCAO_SALT = 'test-salt';
  });

  it('anonimiza mensagens e lead e remove embeddings por padrão', async () => {
    mockPrisma.conversa.findMany.mockResolvedValue([{ id: 'conv-1' }, { id: 'conv-2' }]);
    mockPrisma.mensagem.count.mockResolvedValue(8);
    mockPrisma.mensagem.updateMany.mockResolvedValue({ count: 8 });
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.conversaEmbedding.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.lead.update.mockResolvedValue({ id: 'lead-1' });

    const result = await aplicarRetencaoSeguraLead({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
    });

    expect(result.mensagensAnonimizadas).toBe(8);
    expect(result.conversasAnonimizadas).toBe(2);
    expect(result.embeddingsRemovidos).toBe(3);
    expect(result.preservarRag).toBe(false);

    expect(mockPrisma.mensagem.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversaEmbedding.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('preserva RAG quando solicitado', async () => {
    mockPrisma.conversa.findMany.mockResolvedValue([]);
    mockPrisma.mensagem.count.mockResolvedValue(0);
    mockPrisma.lead.update.mockResolvedValue({ id: 'lead-1' });

    const result = await aplicarRetencaoSeguraLead({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      preservarRag: true,
    });

    expect(result.embeddingsRemovidos).toBe(0);
    expect(result.preservarRag).toBe(true);
    expect(mockPrisma.conversaEmbedding.deleteMany).not.toHaveBeenCalled();
  });
});

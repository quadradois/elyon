const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
  sessaoWhatsapp: {
    findFirst: jest.fn(),
  },
};

const mockResolverEspecialistaCampanha = jest.fn();
const mockGetWhatsAppService = jest.fn();

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../servicos/resolucao-especialista-campanha', () => ({
  resolverEspecialistaCampanha: mockResolverEspecialistaCampanha,
}));

jest.mock('../../../servicos/whatsapp', () => ({
  getWhatsAppService: mockGetWhatsAppService,
}));

import { EncaminharCorretorUseCase } from '../encaminhar-corretor.usecase';

describe('EncaminharCorretorUseCase', () => {
  const useCase = new EncaminharCorretorUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.tenant.findUnique.mockResolvedValue({ nome: 'Imobiliária Teste' });
    mockResolverEspecialistaCampanha.mockResolvedValue(null);
  });

  it('retorna erro quando lead não existe', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      leadId: 'nao-existe',
      motivo: 'Quer falar com humano',
      contextoConversa: 'Cliente pediu contato imediato',
      urgencia: 'NORMAL',
    });

    expect(result).toEqual({ success: false, error: 'Lead não encontrado' });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.create).not.toHaveBeenCalled();
  });

  it('transfere lead existente para atendimento humano e cria tarefa normal', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-1',
      telefone: '5511999999999',
      campanhaOrigem: { id: 'camp-1', tenantId: 'tenant-1' },
    });
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-1',
      motivo: 'Solicitou reunião',
      contextoConversa: 'Falou que tem interesse',
      urgencia: 'NORMAL',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-1');
    expect(result.message).toContain('em breve');
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { modoAtendimento: 'HUMANO' },
    });
    expect(mockPrisma.atividade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          tipo: 'TAREFA',
        }),
      })
    );
  });

  it('identifica tarefa urgente para o lead unificado', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-2',
      telefone: '5511888888888',
      campanhaOrigem: { id: 'camp-2', tenantId: 'tenant-2' },
    });
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-2',
      motivo: 'Pediu proposta',
      contextoConversa: 'Mostrou forte interesse',
      urgencia: 'ALTA',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('imediatamente');
    expect(mockPrisma.atividade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-2',
          titulo: expect.stringContaining('URGENTE'),
        }),
      })
    );
  });

  it('retorna erro quando criação da tarefa falha', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-3',
      telefone: '5511777777777',
      campanhaOrigem: { id: 'camp-3', tenantId: 'tenant-1' },
    });
    mockPrisma.atividade.create.mockRejectedValue(new Error('Erro criando tarefa'));

    const result = await useCase.execute({
      leadId: 'lead-3',
      motivo: 'Quer proposta hoje',
      contextoConversa: 'Insistiu no contato',
      urgencia: 'ALTA',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Erro criando tarefa');
  });
});

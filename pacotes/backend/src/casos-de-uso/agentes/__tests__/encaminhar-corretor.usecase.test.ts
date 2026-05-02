const mockPrisma = {
  contato: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    create: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { EncaminharCorretorUseCase } from '../encaminhar-corretor.usecase';

describe('EncaminharCorretorUseCase', () => {
  const useCase = new EncaminharCorretorUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna erro quando contato não existe', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      leadId: 'nao-existe',
      motivo: 'Quer falar com humano',
      contextoConversa: 'Cliente pediu contato imediato',
      urgencia: 'NORMAL',
    });

    expect(result).toEqual({ success: false, error: 'Contato não encontrado' });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('usa lead existente sem criar novo lead e cria tarefa normal', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-1',
      leadId: 'lead-1',
      virouLead: true,
      campanha: { tenantId: 'tenant-1' },
    });
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'contato-1',
      motivo: 'Solicitou reunião',
      contextoConversa: 'Falou que tem interesse',
      urgencia: 'NORMAL',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-1');
    expect(result.message).toContain('em breve');

    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.contato.update).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          tipo: 'TAREFA',
          titulo: expect.stringContaining('📞'),
        }),
      })
    );
  });

  it('converte contato para lead quando ainda não virou lead', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-2',
      leadId: null,
      virouLead: false,
      nome: 'Joana',
      telefone: '5511999999999',
      email: 'joana@teste.com',
      cpf: '12345678900',
      endereco: 'Rua A',
      campanhaId: 'camp-1',
      criadoEm: new Date('2026-01-01'),
      campanha: { tenantId: 'tenant-2' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-novo' });
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'contato-2',
      motivo: 'Pediu proposta',
      contextoConversa: 'Mostrou forte interesse',
      urgencia: 'ALTA',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-novo');
    expect(result.message).toContain('imediatamente');

    expect(mockPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-2',
          temperatura: 'QUENTE',
          estagio: 'encaminhado_corretor',
        }),
      })
    );

    expect(mockPrisma.contato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contato-2' },
        data: expect.objectContaining({
          virouLead: true,
          leadId: 'lead-novo',
          statusProspeccao: 'LEAD',
        }),
      })
    );

    expect(mockPrisma.atividade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-novo',
          titulo: expect.stringContaining('🔥 URGENTE'),
        }),
      })
    );
  });

  it('retorna erro quando criação da tarefa falha', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-3',
      leadId: 'lead-3',
      virouLead: true,
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.atividade.create.mockRejectedValue(new Error('Erro criando tarefa'));

    const result = await useCase.execute({
      leadId: 'contato-3',
      motivo: 'Quer proposta hoje',
      contextoConversa: 'Insistiu no contato',
      urgencia: 'ALTA',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Erro criando tarefa');
  });
});

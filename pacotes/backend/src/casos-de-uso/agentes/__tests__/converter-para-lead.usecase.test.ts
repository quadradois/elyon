const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  atividade: {
    create: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { ConverterParaLeadUseCase } from '../converter-para-lead.usecase';

describe('ConverterParaLeadUseCase', () => {
  const useCase = new ConverterParaLeadUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function leadBase(overrides: Record<string, any> = {}) {
    return {
      id: 'lead-1',
      statusProspeccao: 'INTERESSADO',
      tipoImovel: null,
      areaImovel: null,
      quartosImovel: null,
      vagasImovel: null,
      valorPretendido: null,
      ocupacaoImovel: null,
      interesseEm: null,
      motivacaoVenda: null,
      situacaoAtual: null,
      prazoDesejado: null,
      urgencia: null,
      doresIdentificadas: [],
      schemaState: null,
      ...overrides,
    };
  }

  it('retorna erro quando lead não encontrado', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      leadId: 'nao-existe',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: '3 meses',
    });

    expect(result).toEqual({
      success: false,
      error: 'Lead não encontrado',
      reasonCode: 'CONTACT_NOT_FOUND',
    });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.create).not.toHaveBeenCalled();
  });

  it('converte lead MORNO com mapeamento de interesse e urgência média', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(leadBase());
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-2',
      temperatura: 'MORNO',
      tipoInteresse: 'AMBOS',
      timeline: '3 meses',
      motivacaoVenda: 'Mudança de emprego',
      doresIdentificadas: ['pouca visitação'],
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-2');
    expect(result.reasonCode).toBe('CONVERTED');

    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-2' },
        data: expect.objectContaining({
          interesseEm: 'ambos',
          urgencia: 'MEDIA',
          status: 'NOVO',
          temperatura: 'MORNO',
        }),
      })
    );
    expect(mockPrisma.atividade.create).toHaveBeenCalledTimes(1);
  });

  it('quando QUENTE cria tarefa urgente adicional', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(leadBase());
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-3',
      temperatura: 'QUENTE',
      tipoInteresse: 'VENDA',
      timeline: 'urgente',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.atividade.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.atividade.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'TAREFA',
          titulo: expect.stringContaining('URGENTE'),
        }),
      })
    );
  });

  it('não persiste área quando areaImovel parece valor monetário e move para valorPretendido', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(leadBase());
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-3b',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      areaImovel: '350 mil',
      timeline: 'sem prazo definido',
    });

    expect(result.success).toBe(true);
    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.data.areaImovel).toBeUndefined();
    expect(updateArg.data.valorPretendido).toBe('350 mil');
    expect(updateArg.data.prazoDesejado).toBeUndefined();
    expect(updateArg.data.urgencia).toBeUndefined();
  });

  it('faz merge de dores sem duplicar valores', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(leadBase({ doresIdentificadas: ['sem visitas'] }));
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    await useCase.execute({
      leadId: 'lead-merge-dores',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      doresIdentificadas: ['sem visitas', 'propostas baixas'],
    });

    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.data.doresIdentificadas).toEqual(['sem visitas', 'propostas baixas']);
  });

  it('retorna erro quando ocorre exceção no update', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(leadBase());
    mockPrisma.lead.update.mockRejectedValue(new Error('Falha no banco'));

    const result = await useCase.execute({
      leadId: 'lead-4',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: '2 meses',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha no banco');
    expect(result.reasonCode).toBe('DB_ERROR');
  });
});

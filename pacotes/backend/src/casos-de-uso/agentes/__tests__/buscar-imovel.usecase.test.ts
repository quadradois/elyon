const mockPrisma = {
  imovel: {
    findMany: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { BuscarImovelUseCase } from '../buscar-imovel.usecase';

describe('BuscarImovelUseCase', () => {
  const useCase = new BuscarImovelUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna mensagem quando não há imóveis', async () => {
    mockPrisma.imovel.findMany.mockResolvedValue([]);

    const result = await useCase.execute({ leadId: 'lead-1' });

    expect(result).toEqual({
      success: false,
      message: 'Nenhum imóvel cadastrado para este lead.',
      imoveis: [],
    });

    expect(mockPrisma.imovel.findMany).toHaveBeenCalledWith({
      where: { leadId: 'lead-1' },
      select: expect.any(Object),
      orderBy: { criadoEm: 'desc' },
    });
  });

  it('retorna imóveis formatados com sucesso', async () => {
    mockPrisma.imovel.findMany.mockResolvedValue([
      {
        id: 'imovel-1',
        logradouro: 'Rua A',
        numero: '100',
        bairro: 'Centro',
        nomeEdificio: 'Ed. Sol',
        areaTerreno: null,
        areaEdificada: 120,
        statusCaptacao: 'EM_ANDAMENTO',
        interesse: 'VENDA',
      },
      {
        id: 'imovel-2',
        logradouro: 'Av. B',
        numero: null,
        bairro: 'Jardins',
        nomeEdificio: null,
        areaTerreno: null,
        areaEdificada: null,
        statusCaptacao: 'NOVO',
        interesse: 'LOCACAO',
      },
    ]);

    const result = await useCase.execute({ leadId: 'lead-2' });

    expect(result.success).toBe(true);
    expect(result.totalImoveis).toBe(2);
    expect(result.imoveis).toEqual([
      {
        endereco: 'Rua A, 100 - Centro',
        edificio: 'Ed. Sol',
        area: '120m²',
        status: 'EM_ANDAMENTO',
        interesse: 'VENDA',
      },
      {
        endereco: 'Av. B - Jardins',
        edificio: null,
        area: null,
        status: 'NOVO',
        interesse: 'LOCACAO',
      },
    ]);
  });

  it('retorna erro quando busca no banco falha', async () => {
    mockPrisma.imovel.findMany.mockRejectedValue(new Error('DB offline'));

    const result = await useCase.execute({ leadId: 'lead-3' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB offline');
  });
});

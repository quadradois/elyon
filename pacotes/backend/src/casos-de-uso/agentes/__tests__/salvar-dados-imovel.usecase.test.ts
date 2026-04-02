const mockPrisma = {
  lead: {
    update: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { SalvarDadosImovelUseCase } from '../salvar-dados-imovel.usecase';

describe('SalvarDadosImovelUseCase', () => {
  const useCase = new SalvarDadosImovelUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna erro quando nenhum dado do imóvel é enviado', async () => {
    const result = await useCase.execute({ leadId: 'lead-1' });

    expect(result).toEqual({ success: false, error: 'Nenhum dado do imóvel fornecido' });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('salva campos mapeados corretamente', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-2',
      tipo: 'Apartamento',
      quartos: 3,
      suites: 1,
      banheiros: 2,
      vagas: 2,
      areaUtil: 80,
      areaTotal: 95,
      andar: 7,
      valorVenda: 500000,
      valorLocacao: 3500,
      valorCondominio: 800,
      valorIPTU: 250,
      caracteristicas: ['Varanda', 'Lazer completo'],
      descricao: 'Imóvel reformado',
      fotos: ['https://img/1.jpg'],
    });

    expect(result.success).toBe(true);
    expect(result.camposSalvos).toEqual(
      expect.arrayContaining([
        'tipoImovel',
        'quartosImovel',
        'imovelSuites',
        'imovelBanheiros',
        'vagasImovel',
        'imovelAreaTotal',
        'imovelAndar',
        'valorPretendido',
        'imovelValorLocacao',
        'imovelValorCondominio',
        'imovelValorIPTU',
        'imovelCaracteristicas',
        'imovelDescricao',
        'imovelFotos',
      ])
    );

    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'lead-2' });
    expect(updateArg.data.tipoImovel).toBe('Apartamento');
    expect(updateArg.data.imovelAreaTotal).toBe(95);
    expect(updateArg.data.valorPretendido).toMatch(/^R\$\s?500/);
  });

  it('aceita valores numéricos zero (não ignora 0)', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-3',
      quartos: 0,
      vagas: 0,
      valorCondominio: 0,
      valorIPTU: 0,
    });

    expect(result.success).toBe(true);

    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.data.quartosImovel).toBe(0);
    expect(updateArg.data.vagasImovel).toBe(0);
    expect(updateArg.data.imovelValorCondominio).toBe(0);
    expect(updateArg.data.imovelValorIPTU).toBe(0);
  });

  it('retorna erro quando update falha', async () => {
    mockPrisma.lead.update.mockRejectedValue(new Error('Sem conexão'));

    const result = await useCase.execute({
      leadId: 'lead-4',
      tipo: 'Casa',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Sem conexão');
  });
});

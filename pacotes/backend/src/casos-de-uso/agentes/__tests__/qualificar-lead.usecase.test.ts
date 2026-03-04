const mockPrisma = {
  contato: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    create: jest.fn(),
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

import { QualificarLeadUseCase } from '../qualificar-lead.usecase';

describe('QualificarLeadUseCase', () => {
  const useCase = new QualificarLeadUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna erro quando contato não existe', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      contatoId: 'contato-inexistente',
      temperatura: 'MORNO',
      interesse: 'Vender rápido',
      timeline: '2 meses',
    });

    expect(result).toEqual({ success: false, error: 'Contato não encontrado' });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('qualifica lead existente sem criar novo lead', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-1',
      leadId: 'lead-1',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: [],
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender apartamento',
      tipoImovel: null,
      areaImovel: null,
      valorPretendido: null,
      ocupacaoImovel: null,
      doresIdentificadas: [],
      situacaoAtual: null,
      motivacaoVenda: null,
      consequencias: null,
      custosAtuais: null,
    });

    const result = await useCase.execute({
      contatoId: 'contato-1',
      temperatura: 'QUENTE',
      interesse: 'Vender apartamento',
      timeline: '3 meses',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-1');
    expect(result.leadCriado).toBe(false);
    expect(result.prontidaoQualificacao).toBe('PARCIAL');
    expect(result.camposFaltantesCriticos).toEqual(
      expect.arrayContaining(['tipoImovel', 'areaImovel', 'implicacao'])
    );

    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.contato.update).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.create).toHaveBeenCalledTimes(1);
  });

  it('cria lead novo, enriquece dados e retorna prontidão completa', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-2',
      leadId: null,
      campanhaId: 'camp-1',
      criadoEm: new Date('2026-01-01'),
      nome: 'Maria',
      telefone: '5511999999999',
      email: 'maria@teste.com',
      cpf: '12345678900',
      endereco: 'Rua A',
      enderecoImovel: 'Rua B',
      tipoImovel: 'Apartamento',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-novo' });
    mockPrisma.contato.update.mockResolvedValue({});

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: ['falta tempo'],
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender apartamento',
      tipoImovel: 'Apartamento',
      areaImovel: '85m2',
      valorPretendido: 'R$ 700.000',
      ocupacaoImovel: 'Ocupado',
      doresIdentificadas: ['falta tempo', 'não sabe precificar'],
      situacaoAtual: 'Anunciando por conta',
      motivacaoVenda: 'Mudança de cidade',
      consequencias: 'Imóvel parado',
      custosAtuais: null,
    });

    const result = await useCase.execute({
      contatoId: 'contato-2',
      temperatura: 'QUENTE',
      interesse: 'Vender apartamento',
      timeline: 'urgente',
      doresIdentificadas: ['falta tempo', 'não sabe precificar'],
      motivacaoVenda: 'Mudança de cidade',
      situacaoAtual: 'Anunciando por conta',
      consequencias: 'Imóvel parado',
      tipoImovel: 'Apartamento',
      areaImovel: '85m2',
      valorPretendido: 'R$ 700.000',
      ocupacaoImovel: 'Ocupado',
    });

    expect(result.success).toBe(true);
    expect(result.leadCriado).toBe(true);
    expect(result.leadId).toBe('lead-novo');
    expect(result.prontidaoQualificacao).toBe('COMPLETA');

    expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.contato.update).toHaveBeenCalledWith({
      where: { id: 'contato-2' },
      data: expect.objectContaining({
        virouLead: true,
        leadId: 'lead-novo',
        statusProspeccao: 'LEAD',
      }),
    });

    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-novo' },
        data: expect.objectContaining({
          urgencia: 'ALTA',
          interesseEm: 'Vender apartamento',
          doresIdentificadas: ['falta tempo', 'não sabe precificar'],
        }),
      })
    );
  });

  it('retorna erro quando ocorre exceção no banco', async () => {
    mockPrisma.contato.findUnique.mockRejectedValue(new Error('DB offline'));

    const result = await useCase.execute({
      contatoId: 'contato-1',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: 'breve',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB offline');
  });
});

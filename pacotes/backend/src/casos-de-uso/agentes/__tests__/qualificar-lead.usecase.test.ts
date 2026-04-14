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
      status: 'QUALIFICADO',
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
    expect(result.statusLead).toBe('QUALIFICADO');
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
      status: 'NOVO',
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
      pressaoTempo: true,
      pressaoTempoEvidencia: 'Preciso vender rápido por causa da transferência.',
      interesseAvaliacao: true,
      interesseAvaliacaoEvidencia: 'Pode marcar a avaliação sim.',
    });

    expect(result.success).toBe(true);
    expect(result.leadCriado).toBe(true);
    expect(result.leadId).toBe('lead-novo');
    expect(result.prontidaoQualificacao).toBe('COMPLETA');
    expect(result.statusLead).toBe('QUALIFICADO');

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
          pressaoTempo: true,
          interesseAvaliacao: true,
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

  it('grava estadoConservacao, situacaoFinanceira e temDividas quando fornecidos', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-5',
      leadId: 'lead-5',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: ['sem visitas'],
      status: 'NOVO',
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender',
      tipoImovel: 'Apartamento',
      areaImovel: '90m2',
      valorPretendido: 'R$ 500.000',
      ocupacaoImovel: 'vazio',
      doresIdentificadas: ['sem visitas'],
      situacaoAtual: 'Parado há 6 meses',
      motivacaoVenda: 'Mudança',
      consequencias: 'Pagando condomínio sem morar',
      custosAtuais: 'R$ 800/mês',
    });

    const result = await useCase.execute({
      contatoId: 'contato-5',
      temperatura: 'QUENTE',
      interesse: 'Vender',
      timeline: 'urgente',
      doresIdentificadas: ['sem visitas'],
      tipoImovel: 'Apartamento',
      areaImovel: '90m2',
      estadoConservacao: 'bom',
      situacaoFinanceira: 'quitado',
      temDividas: false,
      temDividasEvidencia: 'Não tenho dívidas, está tudo em dia.',
    });

    expect(result.success).toBe(true);
    expect(result.camposAtualizados).toEqual(
      expect.arrayContaining(['estadoConservacao', 'situacaoFinanceira', 'temDividas'])
    );

    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estadoConservacao: 'bom',
          situacaoFinanceira: 'quitado',
          temDividas: false,
        }),
      })
    );
  });

  it('não persiste temDividas/comCorretorAtualmente sem evidência explícita', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-6a',
      leadId: 'lead-6a',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: [],
      status: 'NOVO',
      schemaState: {},
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender',
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
      contatoId: 'contato-6a',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: '3 meses',
      temDividas: false,
      comCorretorAtualmente: false,
      pressaoTempo: true,
      interesseAvaliacao: true,
    });

    expect(result.success).toBe(true);
    const updateCallDados = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateCallDados.data.temDividas).toBeUndefined();
    expect(updateCallDados.data.comCorretorAtualmente).toBeUndefined();
    expect(updateCallDados.data.pressaoTempo).toBeUndefined();
    expect(updateCallDados.data.interesseAvaliacao).toBeUndefined();
  });

  it('não persiste prazo/urgência quando timeline não é temporalmente confiável', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-6b',
      leadId: 'lead-6b',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: [],
      status: 'NOVO',
      schemaState: {},
    });

    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender',
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
      contatoId: 'contato-6b',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: 'sem prazo definido',
    });

    expect(result.success).toBe(true);
    const updateCallDados = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateCallDados.data.prazoDesejado).toBeUndefined();
    expect(updateCallDados.data.urgencia).toBeUndefined();
  });

  it('mantém lead novo como NOVO quando prontidão de qualificação é parcial', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-6',
      leadId: null,
      campanhaId: 'camp-1',
      criadoEm: new Date('2026-01-01'),
      nome: 'João',
      telefone: '5511888888888',
      email: 'joao@teste.com',
      cpf: '98765432100',
      endereco: 'Rua C',
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-parcial' });
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: [],
      status: 'NOVO',
    });
    mockPrisma.lead.update.mockResolvedValue({
      interesseEm: 'Vender',
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
      contatoId: 'contato-6',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: '6 meses',
    });

    expect(result.success).toBe(true);
    expect(result.leadCriado).toBe(true);
    expect(result.prontidaoQualificacao).toBe('PARCIAL');
    expect(result.statusLead).toBe('NOVO');
    expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2);
    const updateCallDados = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateCallDados.where).toEqual({ id: 'lead-parcial' });
    expect(updateCallDados.data.status).toBeUndefined();

    const updateCallSchema = mockPrisma.lead.update.mock.calls[1][0];
    expect(updateCallSchema.where).toEqual({ id: 'lead-parcial' });
    expect(updateCallSchema.data).toEqual(
      expect.objectContaining({
        schemaState: expect.any(Object),
      })
    );
  });
});

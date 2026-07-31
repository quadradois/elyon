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

  it('retorna erro quando lead não existe', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      contatoId: 'contato-inexistente',
      temperatura: 'MORNO',
      interesse: 'Vender rápido',
      timeline: '2 meses',
    });

    expect(result).toEqual({ success: false, error: 'Lead não encontrado' });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('qualifica lead existente quando recebe leadId canônico sem contatoId', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-canonico-1' })
      .mockResolvedValueOnce({
        doresIdentificadas: [],
        status: 'QUALIFICADO',
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
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-canonico-1',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: '3 meses',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-canonico-1');
    expect(result.leadCriado).toBe(false);
    expect(mockPrisma.contato.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('aceita contatoId legado quando ele aponta para um lead válido', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-legado-1' })
      .mockResolvedValueOnce({
        doresIdentificadas: [],
        status: 'QUALIFICADO',
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
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'lead-legado-1',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: '3 meses',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-legado-1');
    expect(result.leadCriado).toBe(false);
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('qualifica lead existente via alias contatoId sem criar novo lead', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-1', enderecoImovel: null, tipoImovel: null })
      .mockResolvedValueOnce({ doresIdentificadas: [], status: 'QUALIFICADO', schemaState: {} });

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
      contatoId: 'lead-1',
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

  it('enriquece lead canônico e retorna prontidão completa', async () => {
    mockPrisma.lead.findUnique
      .mockResolvedValueOnce({ id: 'lead-canonico', enderecoImovel: 'Rua B', tipoImovel: 'Apartamento' })
      .mockResolvedValueOnce({ doresIdentificadas: ['falta tempo'], status: 'NOVO', schemaState: {} });

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
      leadId: 'lead-canonico',
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
    expect(result.leadCriado).toBe(false);
    expect(result.leadId).toBe('lead-canonico');
    expect(result.prontidaoQualificacao).toBe('COMPLETA');
    expect(result.statusLead).toBe('QUALIFICADO');

    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.contato.update).not.toHaveBeenCalled();

    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-canonico' },
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
    mockPrisma.lead.findUnique.mockRejectedValue(new Error('DB offline'));

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

  it('mantém lead canônico como NOVO quando prontidão de qualificação é parcial', async () => {
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
      leadId: 'lead-parcial',
      temperatura: 'MORNO',
      interesse: 'Vender',
      timeline: '6 meses',
    });

    expect(result.success).toBe(true);
    expect(result.leadCriado).toBe(false);
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

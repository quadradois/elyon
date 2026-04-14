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

const mockRagConversasService = {
  processarConversaoProspeccao: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../servicos/rag-conversas', () => ({
  ragConversasService: mockRagConversasService,
}));

import { ConverterParaLeadUseCase } from '../converter-para-lead.usecase';

describe('ConverterParaLeadUseCase', () => {
  const useCase = new ConverterParaLeadUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRagConversasService.processarConversaoProspeccao.mockResolvedValue(undefined);
  });

  it('retorna erro quando contato não encontrado', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({
      contatoId: 'nao-existe',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: '3 meses',
    });

    expect(result).toEqual({
      success: false,
      error: 'Contato não encontrado',
      reasonCode: 'CONTACT_NOT_FOUND',
    });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('retorna erro quando contato já virou lead', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-1',
      virouLead: true,
      leadId: 'lead-existente',
      campanha: { tenantId: 'tenant-1' },
    });

    const result = await useCase.execute({
      contatoId: 'contato-1',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: 'breve',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Contato já é lead');
    expect(result.leadId).toBe('lead-existente');
    expect(result.reasonCode).toBe('ALREADY_LEAD');
  });

  it('retorna já convertido quando leadId existe mesmo sem virouLead=true', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-1b',
      virouLead: false,
      leadId: 'lead-ja-vinculado',
      campanha: { tenantId: 'tenant-1' },
    });

    const result = await useCase.execute({
      contatoId: 'contato-1b',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: 'breve',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Contato já é lead');
    expect(result.leadId).toBe('lead-ja-vinculado');
    expect(result.reasonCode).toBe('ALREADY_LEAD');
  });

  it('retorna erro quando contato não tem tenant de campanha', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-sem-tenant',
      virouLead: false,
      leadId: null,
      campanha: null,
    });

    const result = await useCase.execute({
      contatoId: 'contato-sem-tenant',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: 'breve',
    });

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('MISSING_CAMPAIGN_TENANT');
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it('converte lead MORNO com mapeamento de interesse e urgência média', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-2',
      nome: 'João',
      telefone: '5511988888888',
      email: 'joao@teste.com',
      cpf: '11122233344',
      endereco: 'Rua Teste',
      campanhaId: 'camp-1',
      criadoEm: new Date('2026-01-01'),
      nomeEdificio: 'Ed. Sol',
      virouLead: false,
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-2' });
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'contato-2',
      temperatura: 'MORNO',
      tipoInteresse: 'AMBOS',
      timeline: '3 meses',
      motivacaoVenda: 'Mudança de emprego',
      doresIdentificadas: ['pouca visitação'],
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-2');

    expect(mockPrisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          interesseEm: 'ambos',
          urgencia: 'MEDIA',
        }),
      })
    );

    expect(mockPrisma.atividade.create).toHaveBeenCalledTimes(1);
    expect(mockRagConversasService.processarConversaoProspeccao).toHaveBeenCalledWith({
      contatoId: 'contato-2',
      tenantId: 'tenant-1',
      tipoConversao: 'LEAD',
      empreendimento: 'Ed. Sol',
    });
  });

  it('quando QUENTE cria tarefa urgente adicional', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-3',
      nome: 'Paula',
      telefone: '5511977777777',
      email: null,
      cpf: null,
      endereco: 'Rua B',
      campanhaId: 'camp-2',
      criadoEm: new Date('2026-01-02'),
      virouLead: false,
      campanha: { tenantId: 'tenant-2' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-3' });
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'contato-3',
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

  it('não persiste prazo/urgência com timeline sem marcador temporal confiável', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-3b',
      nome: 'Carlos',
      telefone: '5511966666666',
      email: null,
      cpf: null,
      endereco: 'Rua C',
      campanhaId: 'camp-3',
      criadoEm: new Date('2026-01-03'),
      virouLead: false,
      campanha: { tenantId: 'tenant-3' },
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-3b' });
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.atividade.create.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'contato-3b',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: 'sem prazo definido',
    });

    expect(result.success).toBe(true);
    const createArg = mockPrisma.lead.create.mock.calls[0][0];
    expect(createArg.data.prazoDesejado).toBeUndefined();
    expect(createArg.data.urgencia).toBeUndefined();
  });

  it('retorna erro quando ocorre exceção na criação do lead', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-4',
      virouLead: false,
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.lead.create.mockRejectedValue(new Error('Falha no banco'));

    const result = await useCase.execute({
      contatoId: 'contato-4',
      temperatura: 'MORNO',
      tipoInteresse: 'VENDA',
      timeline: '2 meses',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha no banco');
    expect(result.reasonCode).toBe('DB_ERROR');
  });
});

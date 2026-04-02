const mockPrisma = {
  contato: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'token-fixo-123'),
}));

import { AgendarAvaliacaoUseCase } from '../agendar-avaliacao.usecase';

describe('AgendarAvaliacaoUseCase', () => {
  const useCase = new AgendarAvaliacaoUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRagConversasService.processarConversaoProspeccao.mockResolvedValue(undefined);
  });

  it('retorna erro quando contato não é encontrado por id nem por leadId', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);
    mockPrisma.contato.findFirst.mockResolvedValue(null);

    const result = await useCase.execute({
      contatoId: 'nao-existe',
      dataAvaliacao: '10/03/2026 10:00',
    });

    expect(result).toEqual({ success: false, error: 'Contato não encontrado' });
  });

  it('retorna erro quando campanha não possui tenant', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-1',
      nome: 'Carlos',
      telefone: '5511999999999',
      campanha: null,
      virouLead: false,
      leadId: null,
    });

    const result = await useCase.execute({
      contatoId: 'contato-1',
      dataAvaliacao: '10/03/2026 10:00',
    });

    expect(result).toEqual({ success: false, error: 'Campanha sem tenant' });
  });

  it('agenda usando contato existente com leadId já definido e data explícita', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-2',
      nome: 'Maria',
      telefone: '5511888888888',
      enderecoImovel: 'Rua A, 10',
      nomeEdificio: 'Ed. Azul',
      leadId: 'lead-existente',
      virouLead: true,
      campanha: { tenantId: 'tenant-1' },
    });

    mockPrisma.atividade.create.mockResolvedValue({ id: 'atividade-1' });
    mockPrisma.contato.update.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'contato-2',
      dataAvaliacao: '15/03/2026 09:30',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-existente');
    expect(result.atividadeId).toBe('atividade-1');

    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.atividade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-existente',
          tipo: 'AVALIACAO',
          tokenConfirmacao: 'token-fixo-123',
          statusAgendamento: 'PENDENTE',
        }),
      })
    );

    expect(mockRagConversasService.processarConversaoProspeccao).toHaveBeenCalledWith({
      contatoId: 'contato-2',
      tenantId: 'tenant-1',
      tipoConversao: 'AGENDAMENTO',
      empreendimento: 'Ed. Azul',
    });
  });

  it('converte para lead quando necessário e agenda para "amanhã" com hora default', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-3',
      nome: 'João',
      telefone: '5511777777777',
      cpf: '12345678900',
      campanha: { tenantId: 'tenant-2' },
      virouLead: false,
      leadId: null,
    });

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-novo' });
    mockPrisma.atividade.create.mockResolvedValue({ id: 'atividade-2' });
    mockPrisma.contato.update.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'contato-3',
      dataAvaliacao: 'amanhã',
    });

    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-novo');
    expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);

    expect(mockPrisma.contato.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'contato-3' },
        data: expect.objectContaining({
          virouLead: true,
          leadId: 'lead-novo',
          statusProspeccao: 'LEAD',
        }),
      })
    );
  });

  it('faz fallback de busca por leadId quando findUnique não encontra contato', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue(null);
    mockPrisma.contato.findFirst.mockResolvedValue({
      id: 'contato-4',
      nome: 'Paula',
      telefone: '5511666666666',
      campanha: { tenantId: 'tenant-3' },
      virouLead: true,
      leadId: 'lead-4',
    });

    mockPrisma.atividade.create.mockResolvedValue({ id: 'atividade-3' });
    mockPrisma.contato.update.mockResolvedValue({});

    const result = await useCase.execute({
      contatoId: 'lead-4',
      dataAvaliacao: 'hoje 16:15',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.contato.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: 'lead-4' } })
    );
  });

  it('retorna erro quando criação de atividade falha', async () => {
    mockPrisma.contato.findUnique.mockResolvedValue({
      id: 'contato-5',
      nome: 'Bruno',
      telefone: '5511555555555',
      campanha: { tenantId: 'tenant-4' },
      virouLead: true,
      leadId: 'lead-5',
    });

    mockPrisma.atividade.create.mockRejectedValue(new Error('Falha atividade'));

    const result = await useCase.execute({
      contatoId: 'contato-5',
      dataAvaliacao: '10/03/2026 11:00',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha atividade');
  });
});

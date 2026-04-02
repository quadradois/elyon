const mockPrisma = {
  lead: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  cliente: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { MoverParaFaseUseCase } from '../mover-para-fase.usecase';

describe('MoverParaFaseUseCase', () => {
  const useCase = new MoverParaFaseUseCase();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('retorna erro para fase inválida', async () => {
    const result = await useCase.execute({
      leadId: 'lead-1',
      faseDestino: 'FASE5' as any,
      motivo: 'Teste',
    });

    expect(result).toEqual({ success: false, error: 'Fase inválida', reasonCode: 'INVALID_PHASE' });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('move para FASE2 com status correto', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-2',
      faseDestino: 'FASE2',
      motivo: 'Lead respondeu',
    });

    expect(result.success).toBe(true);
    expect(result.novoStatus).toBe('TENTATIVA_AGENDAMENTO');

    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-2' },
      data: expect.objectContaining({
        status: 'TENTATIVA_AGENDAMENTO',
        ultimaAcaoIA: 'Movido para FASE2: Lead respondeu',
      }),
    });
  });

  it('ao mover para CAPTADO cria cliente quando não existe', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({
      doresIdentificadas: ['poucas visitas', 'sem retorno de corretores'],
      situacaoAtual: 'anunciado no OLX há 3 meses',
      motivacaoVenda: 'mudança de cidade',
      consequencias: 'perda de oportunidades',
      custosAtuais: null,
    });
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.cliente.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findUnique.mockResolvedValue({
      id: 'lead-3',
      tenantId: 'tenant-1',
      nome: 'Carlos',
      cpf: '123',
      email: 'carlos@teste.com',
      telefone: '5511966666666',
      enderecoPrincipal: 'Rua C',
    });
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cliente-1' });

    const result = await useCase.execute({
      leadId: 'lead-3',
      faseDestino: 'CAPTADO',
      motivo: 'Contrato assinado',
    });

    expect(result.success).toBe(true);
    expect(result.novoStatus).toBe('CAPTADO');

    expect(mockPrisma.cliente.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        nome: 'Carlos',
        cpf: '123',
        email: 'carlos@teste.com',
        telefone: '5511966666666',
        endereco: 'Rua C',
        origemLeadId: 'lead-3',
        status: 'ATIVO',
      },
    });
  });

  it('ao mover para CAPTADO não cria cliente se já existir', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({
      doresIdentificadas: ['poucas visitas', 'sem retorno de corretores'],
      situacaoAtual: 'anunciado no OLX há 3 meses',
      motivacaoVenda: 'mudança de cidade',
      consequencias: null,
      custosAtuais: 'condomínio + IPTU mensal',
    });
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'cliente-existente' });

    const result = await useCase.execute({
      leadId: 'lead-4',
      faseDestino: 'CAPTADO',
      motivo: 'Fechado',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.lead.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.cliente.create).not.toHaveBeenCalled();
  });

  it('retorna erro quando lead.update lança exceção', async () => {
    mockPrisma.lead.findUnique.mockResolvedValueOnce({
      doresIdentificadas: ['poucas visitas', 'sem retorno de corretores'],
      situacaoAtual: 'anunciado no OLX há 3 meses',
      motivacaoVenda: 'mudança de cidade',
      consequencias: null,
      custosAtuais: 'condomínio + IPTU mensal',
    });
    mockPrisma.lead.update.mockRejectedValue(new Error('Erro inesperado'));

    const result = await useCase.execute({
      leadId: 'lead-5',
      faseDestino: 'FASE1',
      motivo: 'Reinício',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Erro inesperado');
    expect(result.reasonCode).toBe('INTERNAL_ERROR');
  });

  it('bloqueia mover para FASE3 quando qualificação SPIN está incompleta', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({
      doresIdentificadas: ['poucas visitas'],
      situacaoAtual: null,
      motivacaoVenda: 'precisa vender rápido',
      consequencias: null,
      custosAtuais: null,
    });

    const result = await useCase.execute({
      leadId: 'lead-spin-incompleto',
      faseDestino: 'FASE3',
      motivo: 'Lead aceitou proposta',
    });

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe('SPIN_QUALIFICATION_REQUIRED');
    expect(result.error).toBe('Qualificação SPIN incompleta para avançar de fase');
    expect(result.camposFaltantesQualificacao).toEqual(
      expect.arrayContaining([
        'doresIdentificadas(>=2)',
        'situacaoAtual',
        'implicacao(custosAtuais|consequencias)'
      ])
    );
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('grava autorizouAnuncio via dadosAdicionais ao mover de fase', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-anuncio',
      faseDestino: 'FASE2',
      motivo: 'Cliente aceitou anunciar',
      dadosAdicionais: {
        tipoAutorizacao: 'exclusiva',
        prazoTrabalho: 90,
        comissaoAcordada: '6%',
        autorizouAnuncio: true,
      },
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-anuncio' },
      data: expect.objectContaining({
        tipoAutorizacao: 'exclusiva',
        prazoTrabalho: 90,
        comissaoAcordada: '6%',
        autorizouAnuncio: true,
      }),
    });
  });
});

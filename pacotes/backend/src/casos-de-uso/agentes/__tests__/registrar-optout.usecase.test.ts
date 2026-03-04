const mockPrisma = {
  contato: {
    update: jest.fn(),
  },
  lead: {
    update: jest.fn(),
  },
  conversa: {
    updateMany: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { RegistrarOptoutUseCase } from '../registrar-optout.usecase';

describe('RegistrarOptoutUseCase', () => {
  const useCase = new RegistrarOptoutUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registra opt-out como contato com sucesso', async () => {
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 1 });

    const result = await useCase.execute({
      contatoId: 'contato-1',
      motivo: 'NAO_INCOMODAR',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('não receberá mais mensagens');

    expect(mockPrisma.contato.update).toHaveBeenCalledWith({
      where: { id: 'contato-1' },
      data: expect.objectContaining({
        statusProspeccao: 'OPTOUT',
        motivoDesinteresse: 'NAO_INCOMODAR',
        observacoes: 'Opt-out: NAO_INCOMODAR',
      }),
    });

    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(mockPrisma.conversa.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leadId: 'contato-1', estadoConversa: 'ativa' },
        data: expect.objectContaining({ estadoConversa: 'concluida' }),
      })
    );
  });

  it('faz fallback para lead quando update de contato falha', async () => {
    mockPrisma.contato.update.mockRejectedValue(new Error('Contato não encontrado'));
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 0 });

    const result = await useCase.execute({
      contatoId: 'lead-1',
      motivo: 'IMOVEL_VENDIDO',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        status: 'PERDIDO',
      }),
    });
  });

  it('retorna erro quando contato e lead falham', async () => {
    mockPrisma.contato.update.mockRejectedValue(new Error('Falha contato'));
    mockPrisma.lead.update.mockRejectedValue(new Error('Falha lead'));

    const result = await useCase.execute({
      contatoId: 'id-invalido',
      motivo: 'OUTRO',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha lead');
    expect(mockPrisma.conversa.updateMany).not.toHaveBeenCalled();
  });

  it('retorna erro quando encerrar conversa falha', async () => {
    mockPrisma.contato.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockRejectedValue(new Error('Falha conversa'));

    const result = await useCase.execute({
      contatoId: 'contato-2',
      motivo: 'SEM_INTERESSE_AGORA',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha conversa');
  });
});

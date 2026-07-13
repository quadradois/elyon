const mockPrisma = {
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

  it('registra opt-out no lead unificado com sucesso', async () => {
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 1 });

    const result = await useCase.execute({
      leadId: 'lead-1',
      motivo: 'NAO_INCOMODAR',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('não receberá mais mensagens');

    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        statusProspeccao: 'OPTOUT',
        motivoDesinteresse: 'NAO_INCOMODAR',
        ultimaInteracao: expect.any(Date),
      }),
    });

    expect(mockPrisma.conversa.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leadId: 'lead-1', estadoConversa: 'ativa' },
        data: expect.objectContaining({ estadoConversa: 'concluida' }),
      })
    );
  });

  it('persiste o motivo do opt-out no lead unificado', async () => {
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockResolvedValue({ count: 0 });

    const result = await useCase.execute({
      leadId: 'lead-1',
      motivo: 'IMOVEL_VENDIDO',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        statusProspeccao: 'OPTOUT',
        motivoDesinteresse: 'IMOVEL_VENDIDO',
      }),
    });
  });

  it('retorna erro quando a atualização do lead falha', async () => {
    mockPrisma.lead.update.mockRejectedValue(new Error('Falha lead'));

    const result = await useCase.execute({
      leadId: 'id-invalido',
      motivo: 'OUTRO',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha lead');
    expect(mockPrisma.conversa.updateMany).not.toHaveBeenCalled();
  });

  it('retorna erro quando encerrar conversa falha', async () => {
    mockPrisma.lead.update.mockResolvedValue({});
    mockPrisma.conversa.updateMany.mockRejectedValue(new Error('Falha conversa'));

    const result = await useCase.execute({
      leadId: 'lead-2',
      motivo: 'SEM_INTERESSE_AGORA',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha conversa');
  });
});

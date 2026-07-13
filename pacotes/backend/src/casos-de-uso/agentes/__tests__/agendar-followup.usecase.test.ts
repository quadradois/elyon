const mockPrisma = {
  lead: {
    update: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { AgendarFollowupUseCase } from '../agendar-followup.usecase';

describe('AgendarFollowupUseCase', () => {
  const useCase = new AgendarFollowupUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agenda recontato com sucesso em data válida', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-1',
      dataRecontato: '20/03/2026',
      motivo: 'Cliente pediu retorno no fim do mês',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('20/03/2026');
    expect(result.dataRecontato).toBeDefined();

    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        statusProspeccao: 'MORNO_FUTURO',
        motivoRecontato: 'Cliente pediu retorno no fim do mês',
        observacoes: 'Futuro: Cliente pediu retorno no fim do mês',
      }),
    });

    const dataArg = mockPrisma.lead.update.mock.calls[0][0].data.dataRecontato;
    expect(dataArg).toBeInstanceOf(Date);
    expect(dataArg.getHours()).toBe(9);
    expect(dataArg.getMinutes()).toBe(0);
  });

  it('retorna erro para data inválida', async () => {
    const result = await useCase.execute({
      leadId: 'lead-2',
      dataRecontato: 'data-invalida',
      motivo: 'Teste',
    });

    expect(result).toEqual({
      success: false,
      error: 'Data inválida. Use DD/MM/YYYY',
    });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('retorna erro quando prisma update falha', async () => {
    mockPrisma.lead.update.mockRejectedValue(new Error('Falha de banco'));

    const result = await useCase.execute({
      leadId: 'lead-3',
      dataRecontato: '10/04/2026',
      motivo: 'Aguardar decisão familiar',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Falha de banco');
  });

  it('preserva motivo no campo observacoes', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    await useCase.execute({
      leadId: 'lead-4',
      dataRecontato: '01/05/2026',
      motivo: 'Retorno após viagem',
    });

    expect(mockPrisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          observacoes: 'Futuro: Retorno após viagem',
        }),
      })
    );
  });
});

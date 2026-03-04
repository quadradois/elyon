const mockPrisma = {
  lead: {
    update: jest.fn(),
  },
};

jest.mock('../../../lib/db', () => ({
  prisma: mockPrisma,
}));

import { AtualizarDadosLeadUseCase } from '../atualizar-dados-lead.usecase';

describe('AtualizarDadosLeadUseCase', () => {
  const useCase = new AtualizarDadosLeadUseCase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna erro quando nenhum dado foi informado', async () => {
    const result = await useCase.execute({
      leadId: 'lead-1',
    });

    expect(result).toEqual({ success: false, error: 'Nenhum dado fornecido para atualização' });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('atualiza cpf normalizando caracteres não numéricos', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-2',
      cpf: '123.456.789-00',
    });

    expect(result.success).toBe(true);
    expect(result.mensagem).toBe('Dados atualizados com sucesso');
    expect(mockPrisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-2' },
      data: expect.objectContaining({
        cpf: '12345678900',
      }),
    });
  });

  it('atualiza múltiplos campos com mapeamento de endereco para enderecoPrincipal', async () => {
    mockPrisma.lead.update.mockResolvedValue({});

    const result = await useCase.execute({
      leadId: 'lead-3',
      nome: 'Ana Paula',
      email: 'ana@teste.com',
      endereco: 'Rua Nova, 123',
    });

    expect(result.success).toBe(true);

    const callArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 'lead-3' });
    expect(callArg.data).toEqual(
      expect.objectContaining({
        nome: 'Ana Paula',
        email: 'ana@teste.com',
        enderecoPrincipal: 'Rua Nova, 123',
      })
    );
    expect(callArg.data.ultimaInteracao).toBeInstanceOf(Date);
  });

  it('retorna erro genérico quando update falha', async () => {
    mockPrisma.lead.update.mockRejectedValue(new Error('db indisponível'));

    const result = await useCase.execute({
      leadId: 'lead-4',
      email: 'teste@x.com',
    });

    expect(result).toEqual({ success: false, error: 'Erro ao atualizar dados' });
  });
});

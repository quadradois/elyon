const mockPrisma = {
  configuracaoIntegracao: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  lead: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/crypto', () => ({ descriptografar: jest.fn(() => 'decrypted-key') }));

describe('crm-service payload', () => {
  it('nao aplica cidade/estado hardcoded quando endereco nao tem UF', async () => {
    const { __testables } = await import('../crm-service');

    const lead: any = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      campanhaOrigemId: 'camp-1',
      nome: 'Maria',
      cpf: null,
      telefone: '5511999999999',
      email: 'maria@test.com',
      tipoImovel: 'apartamento',
      interesseEm: 'venda',
      enderecoImovel: 'Rua das Flores, 123, Setor Bueno',
      quartosImovel: 3,
      imovelSuites: 1,
      imovelBanheiros: 2,
      vagasImovel: 2,
      imovelAreaTotal: null,
      areaImovel: null,
      imovelAndar: null,
      valorPretendido: 'R$ 650.000',
      imovelValorLocacao: null,
      imovelValorCondominio: null,
      imovelValorIPTU: null,
      imovelCaracteristicas: [],
      imovelDescricao: null,
      imovelFotos: [],
      tipoAutorizacao: null,
      comissaoAcordada: null,
      vigenciaInicio: null,
      vigenciaFim: null,
    };

    const payload = __testables.buildCrmPayload(lead, 'tenant-1');

    expect(payload.imovel.cidade).toBeNull();
    expect(payload.imovel.estado).toBeNull();
  });

  it('faz retry e recupera em falha transitoria do CRM', async () => {
    const { __testables } = await import('../crm-service');

    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ status: 503 } as Response)
      .mockResolvedValueOnce({ status: 200 } as Response);

    const response = await __testables.enviarComRetry('https://crm.test/leads/from-elyon', {
      method: 'POST',
      headers: {},
      body: '{}',
    }, 3);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    fetchMock.mockRestore();
  });
});

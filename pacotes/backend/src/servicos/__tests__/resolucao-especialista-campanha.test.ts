const mockPrisma = {
  campanha: { findUnique: jest.fn() },
  usuario: { findFirst: jest.fn() },
  tenant: { findUnique: jest.fn() },
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));

import { resolverEspecialistaCampanha } from '../resolucao-especialista-campanha';

describe('resolverEspecialistaCampanha', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prioriza responsável da campanha quando elegível', async () => {
    mockPrisma.campanha.findUnique.mockResolvedValue({
      tenantId: 't1',
      responsavelCorretor: { id: 'u1', nome: 'Ana', telefone: '11999999999', email: 'ana@x.com', papel: 'CORRETOR', estaAtivo: true },
      fallbackCorretor: { id: 'u2', nome: 'Bia', telefone: '11988888888', email: 'bia@x.com', papel: 'CORRETOR', estaAtivo: true },
    });

    const res = await resolverEspecialistaCampanha({ tenantId: 't1', campanhaId: 'c1' });

    expect(res?.origem).toBe('RESPONSAVEL_CAMPANHA');
    expect(res?.usuarioId).toBe('u1');
  });

  it('usa fallback quando responsável está inelegível', async () => {
    mockPrisma.campanha.findUnique.mockResolvedValue({
      tenantId: 't1',
      responsavelCorretor: { id: 'u1', nome: 'Ana', telefone: null, email: 'ana@x.com', papel: 'CORRETOR', estaAtivo: true },
      fallbackCorretor: { id: 'u2', nome: 'Bia', telefone: '11988888888', email: 'bia@x.com', papel: 'CORRETOR', estaAtivo: true },
    });

    const res = await resolverEspecialistaCampanha({ tenantId: 't1', campanhaId: 'c1' });

    expect(res?.origem).toBe('FALLBACK_CAMPANHA');
    expect(res?.usuarioId).toBe('u2');
  });

  it('usa pool do tenant quando campanha não tem elegíveis', async () => {
    mockPrisma.campanha.findUnique.mockResolvedValue({
      tenantId: 't1',
      responsavelCorretor: null,
      fallbackCorretor: null,
    });
    mockPrisma.usuario.findFirst.mockResolvedValue({
      id: 'u3', nome: 'Carlos', telefone: '11977777777', email: 'c@x.com', papel: 'CORRETOR', estaAtivo: true,
    });

    const res = await resolverEspecialistaCampanha({ tenantId: 't1', campanhaId: 'c1' });

    expect(res?.origem).toBe('POOL_TENANT');
    expect(res?.usuarioId).toBe('u3');
  });

  it('usa admin ativo como especialista comercial quando não há corretor no tenant', async () => {
    mockPrisma.campanha.findUnique.mockResolvedValue({
      tenantId: 't1', responsavelCorretor: null, fallbackCorretor: null,
    });
    mockPrisma.usuario.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'admin-1', nome: 'Ricardo', telefone: '62999999999', email: 'r@x.com', papel: 'ADMIN', estaAtivo: true,
      });

    const res = await resolverEspecialistaCampanha({ tenantId: 't1', campanhaId: 'c1' });

    expect(res).toMatchObject({
      origem: 'POOL_TENANT', usuarioId: 'admin-1', cargo: 'Especialista Comercial',
    });
    expect(mockPrisma.usuario.findFirst).toHaveBeenCalledTimes(2);
    expect(mockPrisma.usuario.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      select: expect.objectContaining({ estaAtivo: true }),
    }));
    expect(mockPrisma.usuario.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      select: expect.objectContaining({ estaAtivo: true }),
    }));
  });
});

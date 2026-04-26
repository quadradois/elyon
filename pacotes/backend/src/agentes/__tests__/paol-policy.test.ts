const mockPrisma = {
  paolPolitica: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/logger', () => ({ logger: mockLogger }));

import { paolPolicyService } from '../paol-policy';

describe('PAOL Policy Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAOL_EMA_ALPHA = '0.2';
    process.env.PAOL_EXPLORATION_BONUS = '0.05';
  });

  it('decide ação priorizando score de política + prior', async () => {
    mockPrisma.paolPolitica.findMany.mockResolvedValue([
      {
        acao: 'tool:qualificar_lead',
        emaRecompensa: 0.7,
        emaSucesso: 0.8,
        amostra: 12,
      },
    ]);

    const decision = await paolPolicyService.decidirAcao({
      contexto: {
        tenantId: 'tenant-1',
        faseFluxo: 'DESCOBERTA',
        statusLead: 'NOVO',
        agenteInicial: 'SDR',
        sentimento: 'NEUTRO',
      },
      padroesHistoricos: [
        { acao: 'tool:qualificar_lead', amostra: 5, recompensaMedia: 0.6, score: 0.8 },
      ],
      modo: 'AB_VARIANT',
      aplicar: true,
    });

    expect(decision.acaoEscolhida).toBe('tool:qualificar_lead');
    expect(decision.aplicouNaResposta).toBe(true);
    expect(decision.candidatos.length).toBeGreaterThan(0);
  });

  it('aprende com EMA ao atualizar política existente', async () => {
    mockPrisma.paolPolitica.findUnique.mockResolvedValue({
      id: 'p1',
      emaRecompensa: 0.5,
      emaSucesso: 0.5,
      amostra: 10,
    });
    mockPrisma.paolPolitica.update.mockResolvedValue({ id: 'p1' });

    await paolPolicyService.aprender({
      tenantId: 'tenant-1',
      contextoHash: 'ctx-hash-1',
      acaoExecutada: 'tool:qualificar_lead',
      recompensa: 0.9,
      outcome: 'SUCESSO',
      origem: 'ORCHESTRATOR',
      fallback: 'NONE',
    });

    expect(mockPrisma.paolPolitica.update).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.paolPolitica.update.mock.calls[0][0];
    expect(arg.data.amostra).toBe(11);
    expect(arg.data.emaRecompensa).toBeGreaterThan(0.5);
  });
});

const mockPrisma = {
  aprendizadoAgente: {
    create: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
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

import {
  bancoDeAprendizadosService,
  calcularRecompensaTurno,
  normalizarContextoAprendizado,
} from '../banco-aprendizados';

describe('BancoDeAprendizadosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normaliza contexto em formato estável', () => {
    const contexto = normalizarContextoAprendizado({
      faseFluxo: 'fase1_qualificacao',
      statusLead: 'novo',
      agenteInicial: 'sdr',
      sentimento: 'positivo',
    });
    expect(contexto).toBe('FASE1_QUALIFICACAO|NOVO|SDR|POSITIVO');
  });

  it('calcula recompensa com penalidade de fallback', () => {
    const reward = calcularRecompensaTurno({
      sucesso: true,
      outcome: 'SUCESSO',
      fallback: 'ANTI_REPEAT_GUARD',
      toolCalls: 1,
      handoffs: 0,
    });
    expect(reward).toBeLessThan(0.8);
    expect(reward).toBeGreaterThan(-1);
  });

  it('registra aprendizado no banco', async () => {
    mockPrisma.aprendizadoAgente.create.mockResolvedValue({ id: 'apr-1' });

    await bancoDeAprendizadosService.registrar({
      tenantId: 'tenant-1',
      contexto: {
        faseFluxo: 'FASE1',
        statusLead: 'NOVO',
        agenteInicial: 'SDR',
        sentimento: 'NEUTRO',
      },
      acao: 'tool:qualificar_lead',
      resultado: 'SUCESSO',
      recompensa: 0.77,
    });

    expect(mockPrisma.aprendizadoAgente.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.aprendizadoAgente.create.mock.calls[0][0];
    expect(arg.data.tenantId).toBe('tenant-1');
    expect(arg.data.contextoHash).toBeDefined();
    expect(arg.data.recompensa).toBeCloseTo(0.77, 3);
  });

  it('consulta padrões e ordena por score', async () => {
    mockPrisma.aprendizadoAgente.groupBy.mockResolvedValue([
      { acao: 'tool:a', _avg: { recompensa: 0.9 }, _count: { _all: 2 } },
      { acao: 'tool:b', _avg: { recompensa: 0.6 }, _count: { _all: 6 } },
      { acao: 'tool:c', _avg: { recompensa: -0.2 }, _count: { _all: 8 } },
    ]);

    const result = await bancoDeAprendizadosService.consultarPadroes('tenant-1', {
      faseFluxo: 'FASE1',
      statusLead: 'NOVO',
      agenteInicial: 'SDR',
      sentimento: 'NEUTRO',
    }, { limit: 2, minimoAmostra: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    expect(result[0].acao).toBeDefined();
  });

  it('retorna top padrões do tenant com agregação', async () => {
    mockPrisma.aprendizadoAgente.findMany.mockResolvedValue([
      {
        contexto: 'A|B|C|D',
        contextoHash: 'hash1',
        acao: 'tool:qualificar',
        recompensa: 0.8,
        criadoEm: new Date('2026-04-20T10:00:00.000Z'),
      },
      {
        contexto: 'A|B|C|D',
        contextoHash: 'hash1',
        acao: 'tool:qualificar',
        recompensa: 0.6,
        criadoEm: new Date('2026-04-21T10:00:00.000Z'),
      },
      {
        contexto: 'A|B|C|D',
        contextoHash: 'hash1',
        acao: 'tool:qualificar',
        recompensa: 0.9,
        criadoEm: new Date('2026-04-22T10:00:00.000Z'),
      },
    ]);

    const result = await bancoDeAprendizadosService.obterTopPadroesTenant('tenant-1', {
      minimoAmostra: 3,
      limit: 10,
      diasJanela: 30,
    });

    expect(result).toHaveLength(1);
    expect(result[0].acao).toBe('tool:qualificar');
    expect(result[0].amostra).toBe(3);
    expect(result[0].recompensaMedia).toBeCloseTo(0.7666, 2);
  });
});


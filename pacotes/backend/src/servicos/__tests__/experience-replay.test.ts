const mockPrisma = {
  tenant: {
    findMany: jest.fn(),
  },
  aprendizadoAgente: {
    findMany: jest.fn(),
  },
  auditoriaReplayAprendizado: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockBancoDeAprendizadosService = {
  registrar: jest.fn(),
};

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/logger', () => ({ logger: mockLogger }));
jest.mock('../banco-aprendizados', () => ({ bancoDeAprendizadosService: mockBancoDeAprendizadosService }));

import { experienceReplayService } from '../experience-replay';

describe('ExperienceReplayService', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    process.env.LEARNING_BANK_ENABLED = 'true';
    process.env.EXPERIENCE_REPLAY_ENABLED = 'true';
    process.env.EXPERIENCE_REPLAY_RECENT_SAMPLE = '50';
    process.env.EXPERIENCE_REPLAY_HISTORICAL_SAMPLE = '50';
    process.env.EXPERIENCE_REPLAY_HISTORICAL_POOL = '200';
    process.env.EXPERIENCE_REPLAY_RECENT_RATE = '0.2';
    process.env.EXPERIENCE_REPLAY_HISTORICAL_RATE = '0.05';
    process.env.EXPERIENCE_REPLAY_MAX_ADJUSTMENT_PER_PATTERN = '0.2';
    process.env.EXPERIENCE_REPLAY_MAX_TOTAL_ADJUSTMENT = '0.5';
    process.env.EXPERIENCE_REPLAY_MIN_ABS_ADJUSTMENT = '0.01';
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('executa replay diário por tenant e registra auditoria', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
    mockPrisma.auditoriaReplayAprendizado.findFirst.mockResolvedValue(null);

    mockPrisma.aprendizadoAgente.findMany
      .mockResolvedValueOnce([
        {
          contexto: 'FASE1|NOVO|SDR|NEUTRO',
          contextoHash: 'ctx1',
          acao: 'tool:a',
          resultado: 'SUCESSO',
          recompensa: 0.9,
          criadoEm: new Date(),
        },
        {
          contexto: 'FASE1|NOVO|SDR|NEUTRO',
          contextoHash: 'ctx1',
          acao: 'tool:a',
          resultado: 'SUCESSO',
          recompensa: 0.8,
          criadoEm: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          contexto: 'FASE1|NOVO|SDR|NEUTRO',
          contextoHash: 'ctx1',
          acao: 'tool:a',
          resultado: 'PERDA',
          recompensa: -0.4,
          criadoEm: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      ]);

    const result = await experienceReplayService.executarReplayDiario();

    expect(result.status).toBe('SUCESSO');
    expect(result.tenantsProcessados).toBe(1);
    expect(result.ajustesAplicados).toBeGreaterThan(0);
    expect(mockBancoDeAprendizadosService.registrar).toHaveBeenCalled();
    expect(mockPrisma.auditoriaReplayAprendizado.create).toHaveBeenCalled();
  });

  it('pula tenant quando já existe execução no dia', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }]);
    mockPrisma.auditoriaReplayAprendizado.findFirst.mockResolvedValue({
      id: 'audit-1',
      status: 'SUCESSO',
      executadoEm: new Date(),
    });

    const result = await experienceReplayService.executarReplayDiario();

    expect(result.status).toBe('SUCESSO');
    expect(result.resultados[0].status).toBe('PULADO');
    expect(mockPrisma.aprendizadoAgente.findMany).not.toHaveBeenCalled();
  });

  it('retorna desabilitado quando flags estão desligadas', async () => {
    process.env.LEARNING_BANK_ENABLED = 'false';
    process.env.EXPERIENCE_REPLAY_ENABLED = 'false';

    const result = await experienceReplayService.executarReplayDiario();

    expect(result.status).toBe('DESABILITADO');
    expect(result.tenantsProcessados).toBe(0);
  });
});

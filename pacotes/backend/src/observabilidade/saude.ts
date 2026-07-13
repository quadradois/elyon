import { Express, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { getRedisClient } from '../lib/redis';
import { logger } from '../lib/logger';
import { recordReadiness } from './metricas';

export interface DependencyProbe {
  name: string;
  check: () => Promise<unknown>;
}

export interface DependencyStatus {
  name: string;
  status: 'up' | 'down';
  latencyMs: number;
}

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  checkedAt: string;
  durationMs: number;
  dependencies: DependencyStatus[];
}

const DEFAULT_TIMEOUT_MS = 1_500;

function configuredTimeoutMs(): number {
  const parsed = Number(process.env.READINESS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed < 100) return DEFAULT_TIMEOUT_MS;
  return Math.min(parsed, 10_000);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('readiness timeout')), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runProbe(probe: DependencyProbe, timeoutMs: number): Promise<DependencyStatus> {
  const startedAt = process.hrtime.bigint();
  let status: DependencyStatus['status'] = 'up';

  try {
    await withTimeout(Promise.resolve().then(probe.check), timeoutMs);
  } catch (error) {
    status = 'down';
    logger.warn({ dependency: probe.name, err: error }, '[READINESS] Dependencia indisponivel');
  }

  return {
    name: probe.name,
    status,
    latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000),
  };
}

export const defaultDependencyProbes: readonly DependencyProbe[] = Object.freeze([
  {
    name: 'postgres',
    check: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  },
  {
    name: 'redis',
    check: async () => {
      const redis = await getRedisClient();
      await redis.ping();
    },
  },
]);

export class ReadinessService {
  constructor(
    private readonly probes: readonly DependencyProbe[] = defaultDependencyProbes,
    private readonly timeoutMs: number = configuredTimeoutMs(),
  ) {}

  async check(): Promise<ReadinessResult> {
    const startedAt = process.hrtime.bigint();
    const dependencies = await Promise.all(
      this.probes.map((probe) => runProbe(probe, this.timeoutMs)),
    );
    const ready = dependencies.every((dependency) => dependency.status === 'up');

    recordReadiness(
      ready,
      dependencies.map((dependency) => ({
        name: dependency.name,
        ready: dependency.status === 'up',
      })),
    );

    return {
      status: ready ? 'ready' : 'not_ready',
      checkedAt: new Date().toISOString(),
      durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000),
      dependencies,
    };
  }
}

export const readinessService = new ReadinessService();

function livenessHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'alive',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

export function registerHealthRoutes(
  app: Express,
  service: Pick<ReadinessService, 'check'> = readinessService,
): void {
  const readinessHandler = async (_req: Request, res: Response): Promise<void> => {
    const result = await service.check();
    res.status(result.status === 'ready' ? 200 : 503).json(result);
  };

  app.get('/live', livenessHandler);
  app.get('/ready', readinessHandler);
  // Alias mantidos para clientes e monitores existentes.
  app.get('/health', readinessHandler);
  app.get('/api/saude', readinessHandler);
}

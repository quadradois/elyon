import { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { createBackupMetrics } from './backup-metrics';

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  prefix: 'elyon_',
  register: metricsRegistry,
});

const httpRequests = new Counter({
  name: 'elyon_http_requests_total',
  help: 'Total de requisicoes HTTP processadas pelo backend.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const httpDuration = new Histogram({
  name: 'elyon_http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

const httpInFlight = new Gauge({
  name: 'elyon_http_requests_in_flight',
  help: 'Quantidade de requisicoes HTTP atualmente em processamento.',
  registers: [metricsRegistry],
});

const readinessStatus = new Gauge({
  name: 'elyon_readiness_status',
  help: 'Readiness geral do backend: 1 pronto, 0 indisponivel.',
  registers: [metricsRegistry],
});

const dependencyStatus = new Gauge({
  name: 'elyon_dependency_ready',
  help: 'Readiness por dependencia critica: 1 pronta, 0 indisponivel.',
  labelNames: ['dependency'] as const,
  registers: [metricsRegistry],
});

const backupMetrics = createBackupMetrics(metricsRegistry);

function routeLabel(req: Request): string {
  const routePath = req.route?.path;
  if (typeof routePath === 'string') {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${routePath === '/' ? '' : routePath}` || '/';
  }
  return 'unmatched';
}

export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  httpInFlight.inc();

  res.once('finish', () => {
    const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };

    httpInFlight.dec();
    httpRequests.inc(labels);
    httpDuration.observe(labels, elapsedSeconds);
  });

  next();
}

export function recordReadiness(
  ready: boolean,
  dependencies: ReadonlyArray<{ name: string; ready: boolean }>,
): void {
  readinessStatus.set(ready ? 1 : 0);
  for (const dependency of dependencies) {
    dependencyStatus.set({ dependency: dependency.name }, dependency.ready ? 1 : 0);
  }
}

/**
 * Em producao, /metrics e exclusivamente interno. O Traefik sempre adiciona
 * cabecalhos de encaminhamento; o Prometheus acessa o backend diretamente pela
 * rede Docker e nao os envia.
 */
export function requireInternalMetricsAccess(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const forwarded = req.headers.forwarded
    || req.headers['x-forwarded-for']
    || req.headers['x-real-ip'];

  if (forwarded) {
    res.status(404).json({ erro: 'Rota nao encontrada' });
    return;
  }

  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  backupMetrics.refresh();
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.status(200).send(await metricsRegistry.metrics());
}

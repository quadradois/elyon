import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { LogChannel, resolveCorrelationId, runWithLogContext } from '../lib/log-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const UUID_PATH_SEGMENT = /\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?=\/|$)/gi;

export function sanitizeHttpLogPath(path: string): string {
  return path.replace(UUID_PATH_SEGMENT, '/:id');
}

function resolveChannel(req: Request): LogChannel {
  return req.path.startsWith('/webhooks') || req.path.includes('/webhook/')
    ? 'webhook'
    : 'rest';
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = resolveCorrelationId(req.headers[CORRELATION_ID_HEADER]);
  const startedAt = process.hrtime.bigint();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  runWithLogContext({ correlationId, channel: resolveChannel(req) }, () => {
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          http: {
            method: req.method,
            path: sanitizeHttpLogPath(req.path),
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
          },
        },
        '[HTTP] Request completed',
      );
    });

    next();
  });
}

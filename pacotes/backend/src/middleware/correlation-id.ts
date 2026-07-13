import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { LogChannel, resolveCorrelationId, runWithLogContext } from '../lib/log-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

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
            path: req.path,
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

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export type LogChannel = 'rest' | 'webhook' | 'websocket' | 'job' | 'system';

export interface LogContext {
  correlationId: string;
  channel: LogChannel;
  jobId?: string;
}

const storage = new AsyncLocalStorage<LogContext>();
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function resolveCorrelationId(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string' && CORRELATION_ID_PATTERN.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}

export function runWithLogContext<T>(context: LogContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function runWithJobLogContext<T>(jobId: string, callback: () => T): T {
  const current = storage.getStore();
  return storage.run(
    {
      correlationId: current?.correlationId ?? randomUUID(),
      channel: 'job',
      jobId,
    },
    callback,
  );
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

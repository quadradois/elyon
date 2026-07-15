import type { Registry } from 'prom-client';
import { metricsRegistry } from './metricas';

/** Une o registry proprio do processo worker ao registry compartilhado do backend. */
export async function renderizarMetricasWorker(workerRegistry: Registry): Promise<string> {
  const [worker, compartilhadas] = await Promise.all([
    workerRegistry.metrics(),
    metricsRegistry.metrics(),
  ]);
  return `${worker.trim()}\n${compartilhadas.trim()}\n`;
}


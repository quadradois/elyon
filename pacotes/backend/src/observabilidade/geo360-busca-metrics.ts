import { Counter } from 'prom-client';
import { metricsRegistry } from './metricas';

export type ResultadoBuscaEmpreendimento =
  | 'geo360'
  | 'legado_local'
  | 'legado_api'
  | 'mock'
  | 'vazio'
  | 'legado_desabilitado';

const buscasEmpreendimento = new Counter({
  name: 'elyon_geo360_buscas_empreendimento_total',
  help: 'Buscas de empreendimento por fonte que respondeu ao usuario.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry]
});

export function registrarMetricaBuscaEmpreendimento(
  resultado: ResultadoBuscaEmpreendimento
): void {
  buscasEmpreendimento.inc({ resultado });
}

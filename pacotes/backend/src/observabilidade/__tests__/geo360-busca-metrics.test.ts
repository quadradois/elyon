import { beforeEach, describe, expect, it } from '@jest/globals';
import { metricsRegistry } from '../metricas';
import { registrarMetricaBuscaEmpreendimento } from '../geo360-busca-metrics';

describe('métricas de busca de empreendimento GEO360', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it('expõe contadores de GEO360, legado e vazio sem usar o termo como label', async () => {
    registrarMetricaBuscaEmpreendimento('geo360');
    registrarMetricaBuscaEmpreendimento('legado_local');
    registrarMetricaBuscaEmpreendimento('vazio');

    const metricas = await metricsRegistry.metrics();

    expect(metricas).toContain(
      'elyon_geo360_buscas_empreendimento_total{resultado="geo360"} 1'
    );
    expect(metricas).toContain(
      'elyon_geo360_buscas_empreendimento_total{resultado="legado_local"} 1'
    );
    expect(metricas).toContain(
      'elyon_geo360_buscas_empreendimento_total{resultado="vazio"} 1'
    );
    expect(metricas).not.toContain('termo=');
  });
});

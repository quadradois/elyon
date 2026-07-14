import { executarCenario, percentil } from '../benchmark';

describe('harness de capacidade', () => {
  it('calcula percentis pelo nearest-rank', () => {
    expect(percentil([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentil([5, 1, 4, 2, 3], 0.95)).toBe(5);
  });

  it('mede throughput, erros e status sem abortar a janela', async () => {
    const resultado = await executarCenario({
      nome: 'teste',
      duracaoMs: 120,
      concorrencia: 2,
      operacao: async (sequencia) => ({ sucesso: sequencia % 3 !== 0, status: sequencia % 3 !== 0 ? 200 : 500 }),
    });
    expect(resultado.requisicoes).toBeGreaterThan(1);
    expect(resultado.sucessos).toBeGreaterThan(0);
    expect(resultado.erros).toBeGreaterThan(0);
    expect(resultado.throughputPorSegundo).toBeGreaterThan(0);
    expect(resultado.latenciaMs.p99).toBeGreaterThanOrEqual(resultado.latenciaMs.p50);
  });
});

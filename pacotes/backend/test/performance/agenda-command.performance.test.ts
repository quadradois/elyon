import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { avaliarAgendaPolicy } from '../../src/servicos/agenda-policy';
import { AGENDA_COMMERCIAL_POLICY_VERSION, validarComandoAgenda } from '../../src/servicos/coerencia-agenda-estado';

function percentile(sorted: number[], value: number) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

describe('benchmark reproduzível do envelope e política do comando central', () => {
  it('registra p50/p95/p99 e mantém p95 abaixo de 5 ms em processo', () => {
    const durations: number[] = [];
    for (let index = 0; index < 5_000; index += 1) {
      const start = performance.now();
      const command = {
        operacao: 'CANCELAR' as const, tenantId: randomUUID(), leadId: randomUUID(), atividadeId: randomUUID(),
        requestIdentity: { source: 'BASELINE' as const, id: randomUUID() }, ator: 'benchmark', origem: 'BENCHMARK',
        motivo: 'Cancelamento benchmark', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
        ocorridoEm: new Date('2026-08-01T09:00:00Z'), expectedVersion: 0,
      };
      if (validarComandoAgenda(command) !== null) throw new Error('invalid benchmark command');
      const allowed = avaliarAgendaPolicy({
        status: 'CONFIRMADO', agendadoPara: new Date('2026-08-01T10:00:00Z'),
        agora: command.ocorridoEm, duracaoMinutos: 60, ator: 'OPERADOR', acao: 'CANCELAR',
      }).allowed;
      if (!allowed) throw new Error('benchmark policy denied');
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const result = { p50: percentile(durations, 0.50), p95: percentile(durations, 0.95), p99: percentile(durations, 0.99) };
    console.info('[AGENDA_COMMAND_BENCHMARK_MS]', result);
    expect(result.p95).toBeLessThan(5);
  });
});

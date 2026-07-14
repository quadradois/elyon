import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('probes executáveis de falhas conhecidas (não corrigidas na #48)', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => {
    OutboundBaselineHarness.assertDedicatedInfrastructure();
    harness = new OutboundBaselineHarness(prisma, await getRedisClient());
  });
  afterEach(async () => harness.cleanup());
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  it('XF-B16 caracteriza cancelamento que deixa estágio VISITA_AGENDADA incoerente', async () => {
    const fixture = await harness.seed();
    await prisma.lead.update({ where: { id: fixture.leadA }, data: { status: 'VISITA_AGENDADA' } });
    const appointment = await prisma.atividade.create({ data: {
      leadId: fixture.leadA, tipo: 'AVALIACAO', titulo: 'Visita sintética',
      agendadoPara: new Date('2026-01-16T17:00:00.000Z'), statusAgendamento: 'CANCELADO',
      canceladoEm: new Date('2026-01-15T13:00:00.000Z'), canceladoPor: 'sistema',
    } });
    expect(appointment.statusAgendamento).toBe('CANCELADO');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } })).status).toBe('VISITA_AGENDADA');
  });

  it('XF-B04 caracteriza ausência de consolidação durável entre dois eventos sequenciais', async () => {
    const fixture = await harness.seed();
    await harness.acceptInbound(fixture, `part-1-${fixture.runId}`, 'Meu imóvel vazio');
    await harness.acceptInbound(fixture, `part-2-${fixture.runId}`, 'precisa vender');
    await harness.runWorkerOnce(fixture, 'sequential-a');
    await harness.runWorkerOnce(fixture, 'sequential-b');
    expect(harness.doubles.llmCalls).toEqual(['Meu imóvel vazio', 'precisa vender']);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'ENTRADA' } })).toBe(2);
  });
});

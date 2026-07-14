import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { reivindicarProximoEvento } from '../../src/servicos/webhook-inbox';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('baseline executável do fluxo outbound', () => {
  let harness: OutboundBaselineHarness;

  beforeAll(async () => {
    OutboundBaselineHarness.assertDedicatedInfrastructure();
    harness = new OutboundBaselineHarness(prisma, await getRedisClient());
  });
  afterEach(async () => harness.cleanup());
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  it('B01/B02/B03/B05/B06 percorre disparo, inbox, worker e qualificação no mesmo Lead', async () => {
    const fixture = await harness.seed();
    const messageId = await harness.dispatchOnce(fixture);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'SAIDA', messageId } })).toBe(1);
    expect(harness.doubles.evolution.sent).toHaveLength(1);

    const accepted = await harness.acceptInbound(fixture, `evt-${fixture.runId}`, 'Meu imóvel vazio precisa vender');
    expect(accepted).toEqual({ duplicate: false, receiptId: expect.any(String) });
    expect(await prisma.webhookEvento.findUnique({ where: { provedor_eventoId: { provedor: 'EVOLUTION', eventoId: `evt-${fixture.runId}` } } })).toEqual(expect.objectContaining({ status: 'PENDENTE' }));

    await harness.runWorkerOnce(fixture, 'baseline-worker');
    expect(await prisma.lead.count({ where: { id: fixture.leadA, tenantId: fixture.tenantA } })).toBe(1);
    expect(await prisma.lead.findUnique({ where: { id: fixture.leadA } })).toEqual(expect.objectContaining({ statusProspeccao: 'LEAD', manifestouInteresse: true }));
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'ENTRADA' } })).toBe(1);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } })).status).toBe('NOVO');
  });

  it('B10/B12 mantém opt-out e replay idempotentes por contagem', async () => {
    const fixture = await harness.seed();
    const eventId = `optout-${fixture.runId}`;
    await harness.acceptInbound(fixture, eventId, 'Não quero mais, desejo sair');
    await harness.runWorkerOnce(fixture, 'baseline-optout');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } })).statusProspeccao).toBe('OPTOUT');

    expect((await harness.acceptInbound(fixture, eventId, 'Não quero mais, desejo sair')).duplicate).toBe(true);
    expect(await prisma.webhookEvento.count({ where: { eventoId: eventId } })).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'ENTRADA' } })).toBe(1);
  });

  it('B11 bloqueia efeitos de IA em modo HUMANO', async () => {
    const fixture = await harness.seed();
    await prisma.lead.update({ where: { id: fixture.leadA }, data: { modoAtendimento: 'HUMANO' } });
    await harness.acceptInbound(fixture, `human-${fixture.runId}`, 'Meu imóvel vazio precisa vender');
    await harness.runWorkerOnce(fixture, 'baseline-human');
    expect(harness.doubles.llmCalls).toHaveLength(0);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'ENTRADA' } })).toBe(0);
  });

  it('B13 recupera lease expirado após restart', async () => {
    const fixture = await harness.seed();
    const eventId = `restart-${fixture.runId}`;
    await harness.acceptInbound(fixture, eventId, 'fale comigo depois');
    expect(await reivindicarProximoEvento('worker-before-crash')).not.toBeNull();
    await harness.expireLease(eventId);
    await harness.runWorkerOnce(fixture, 'worker-after-restart');
    expect(await prisma.webhookEvento.findFirst({ where: { eventoId: eventId } })).toEqual(expect.objectContaining({ status: 'CONCLUIDO', tentativas: 2 }));
    expect(await prisma.lead.findUnique({ where: { id: fixture.leadA } })).toEqual(expect.objectContaining({ statusProspeccao: 'MORNO_FUTURO', motivoRecontato: 'pedido explícito sintético' }));
  });

  it('B14 registra retry sem mutação parcial quando comando falha', async () => {
    const fixture = await harness.seed();
    const eventId = `failure-${fixture.runId}`;
    await harness.acceptInbound(fixture, eventId, 'Meu imóvel vazio precisa vender');
    await harness.runWorkerOnce(fixture, 'baseline-failure', { fail: true });
    expect(await prisma.webhookEvento.findFirst({ where: { eventoId: eventId } })).toEqual(expect.objectContaining({ status: 'RETRY', tentativas: 1 }));
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'ENTRADA' } })).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } })).statusProspeccao).toBe('AGUARDANDO');
  });

  it('B15 rejeita resolução cross-tenant mesmo com telefone igual', async () => {
    const fixture = await harness.seed();
    await harness.acceptInbound(fixture, `tenant-${fixture.runId}`, 'Meu imóvel vazio precisa vender');
    await harness.runWorkerOnce(fixture, 'baseline-tenant');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadB } })).statusProspeccao).toBe('AGUARDANDO');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadB } })).toBe(0);
  });

  it('B08/B09 persiste follow-up válido e agenda somente com data explícita', async () => {
    const fixture = await harness.seed();
    await harness.acceptInbound(fixture, `follow-${fixture.runId}`, 'fale comigo depois');
    await harness.runWorkerOnce(fixture, 'baseline-follow');
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } });
    expect(lead.dataRecontato).toBeInstanceOf(Date);
    expect(lead.motivoRecontato).toBeTruthy();
    expect(await prisma.atividade.count({ where: { leadId: fixture.leadA, tipo: 'AVALIACAO' } })).toBe(0);
  });

  it('B01/B12 permite somente um claim concorrente e um primeiro disparo', async () => {
    const fixture = await harness.seed();
    await harness.dispatchOnce(fixture);
    await expect(harness.dispatchOnce(fixture)).rejects.toThrow();
    await harness.acceptInbound(fixture, `concurrent-${fixture.runId}`, 'fale comigo depois');
    const claims = await Promise.all([reivindicarProximoEvento('claim-a'), reivindicarProximoEvento('claim-b')]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(harness.doubles.evolution.sent).toHaveLength(1);
  });
});

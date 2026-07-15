import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { criarFollowupOutbound, processarFollowupReivindicado, reagendarFollowupOutbound, reivindicarProximoFollowup } from '../../src/servicos/followup-outbound';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('B08 follow-up outbound duravel', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => { harness = new OutboundBaselineHarness(prisma, await getRedisClient()); });
  afterEach(async () => { await harness.cleanup(); });
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  const input = (f: any, overrides: Record<string, unknown> = {}) => ({ tenantId: f.tenantA, leadId: f.leadA,
    expressaoOriginal: '15/01/2027 09:00', timezoneIana: 'America/Sao_Paulo', motivo: 'Lead pediu retorno apos decisao familiar',
    evidenciaPedido: 'pode me chamar em janeiro as nove', origemPedido: 'BASELINE_B08', agora: new Date('2026-07-15T12:00:00Z'), ...overrides });
  const seedEvidence = (leadId: string) => prisma.mensagemProspeccao.create({ data: { leadId, direcao: 'ENTRADA', conteudo: 'pode me chamar em janeiro as nove' } });

  it('cria com contrato explicito, replay e concorrencia deduplicam', async () => {
    const f = await harness.seed();
    await seedEvidence(f.leadA);
    const [a, b] = await Promise.all([criarFollowupOutbound(input(f)), criarFollowupOutbound(input(f))]);
    expect(a.success && b.success).toBe(true);
    expect(await prisma.followupOutbound.count({ where: { tenantId: f.tenantA, leadId: f.leadA } })).toBe(1);
    const saved = await prisma.followupOutbound.findFirstOrThrow({ where: { leadId: f.leadA } });
    expect(saved).toMatchObject({ status: 'PENDENTE', timezoneIana: 'America/Sao_Paulo', policyVersion: 'followup-v1', tentativas: 0 });
  });

  it('restart/claim, takeover e envio confirmado produzem um unico efeito', async () => {
    const f = await harness.seed();
    await seedEvidence(f.leadA);
    const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const first = await reivindicarProximoFollowup('dead-owner'); expect(first).not.toBeNull();
    await prisma.followupOutbound.update({ where: { id: first!.id }, data: { leaseAte: new Date(Date.now() - 1000) } });
    const takeover = await reivindicarProximoFollowup('new-owner'); expect(takeover!.fencingToken).toBeGreaterThan(first!.fencingToken);
    let staleSends = 0;
    await expect(processarFollowupReivindicado(first!, 'dead-owner', { send: async () => { staleSends++; return {}; } })).rejects.toThrow('FOLLOWUP_LEASE_LOST');
    expect(staleSends).toBe(0);
    let sends = 0;
    expect(await processarFollowupReivindicado(takeover!, 'new-owner', { send: async () => { sends++; return { providerId: 'provider-1' }; } })).toBe('EXECUTADO');
    expect(sends).toBe(1);
    expect(await prisma.efeitoFollowupOutbound.count({ where: { followupId: takeover!.id, status: 'CONCLUIDO' } })).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, conteudo: 'Follow-up outbound confirmado' } })).toBe(1);
  });

  it.each([{ modoAtendimento: 'HUMANO', reason: 'BLOCKED_HUMAN_MODE' }, { modoAtendimento: 'PAUSADO', reason: 'BLOCKED_PAUSED_MODE' }, { statusProspeccao: 'OPTOUT', reason: 'BLOCKED_OPT_OUT' }])('gate $reason cancela sem envio', async (gate) => {
    const f = await harness.seed();
    await seedEvidence(f.leadA);
    const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.lead.update({ where: { id: f.leadA }, data: gate.modoAtendimento ? { modoAtendimento: gate.modoAtendimento } : { statusProspeccao: gate.statusProspeccao } });
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const claimed = await reivindicarProximoFollowup(`gate-${gate.reason}`); let sends = 0;
    await processarFollowupReivindicado(claimed!, `gate-${gate.reason}`, { send: async () => { sends++; return {}; } });
    expect(sends).toBe(0);
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: created.followup.id } })).toMatchObject({ status: 'CANCELADO', reasonCode: gate.reason });
  });

  it('reagendamento cancela o anterior e cria o substituto atomicamente', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA); const old = await criarFollowupOutbound(input(f)); if (!old.success) throw new Error(old.reasonCode);
    const next = await reagendarFollowupOutbound({ ...input(f, { expressaoOriginal: '20/01/2027 10:00' }), followupId: old.followup.id });
    expect(next.success).toBe(true);
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: old.followup.id } })).toMatchObject({ status: 'CANCELADO', reasonCode: 'REAGENDAMENTO' });
    expect(await prisma.followupOutbound.count({ where: { leadId: f.leadA, status: 'PENDENTE' } })).toBe(1);
  });

  it('falha comprovadamente antes do envio mantem retry; resultado ambiguo fica fail-closed', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA); const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    let claimed = await reivindicarProximoFollowup('retry-owner');
    const transient = Object.assign(new Error('PROVIDER_UNAVAILABLE'), { definitiveNoSend: true });
    expect(await processarFollowupReivindicado(claimed!, 'retry-owner', { send: async () => { throw transient; } })).toBe('FALHO');
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: created.followup.id } })).toMatchObject({ status: 'FALHO', reasonCode: 'DELIVERY_TRANSIENT' });
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { proximoRetryEm: new Date(Date.now() - 1) } });
    claimed = await reivindicarProximoFollowup('ambiguous-owner');
    await processarFollowupReivindicado(claimed!, 'ambiguous-owner', { send: async () => { throw new Error('PROVIDER_TIMEOUT'); } });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: created.followup.id } })).toMatchObject({ status: 'FALHO', reasonCode: 'DELIVERY_UNKNOWN', proximoRetryEm: null });
    expect(await reivindicarProximoFollowup('must-not-retry-ambiguous')).toBeNull();
  });

  it('crash apos envio antes da confirmacao fica fail-closed sem resposta fantasma ou reenvio', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA); const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const first = await reivindicarProximoFollowup('crash-owner'); let sends = 0;
    await processarFollowupReivindicado(first!, 'crash-owner', { send: async () => {
      sends++; await prisma.followupOutbound.update({ where: { id: first!.id }, data: { leaseAte: new Date(Date.now() - 1000) } }); return { providerId: 'sent-before-crash' };
    } });
    expect(sends).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, conteudo: 'Follow-up outbound confirmado' } })).toBe(0);
    expect(await prisma.efeitoFollowupOutbound.findUniqueOrThrow({ where: { followupId: first!.id } })).toMatchObject({ status: 'RESERVADO' });
    expect(await reivindicarProximoFollowup('reconcile-owner')).toBeNull();
    expect(sends).toBe(1);
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: first!.id } })).toMatchObject({ status: 'FALHO', reasonCode: 'DELIVERY_UNKNOWN', proximoRetryEm: null });
  });

  it('isola tenants com telefone igual', async () => {
    const f = await harness.seed();
    await Promise.all([seedEvidence(f.leadA), seedEvidence(f.leadB)]);
    await Promise.all([criarFollowupOutbound(input(f)), criarFollowupOutbound(input(f, { tenantId: f.tenantB, leadId: f.leadB }))]);
    expect(await prisma.followupOutbound.count()).toBe(2);
    expect(await prisma.followupOutbound.count({ where: { tenantId: f.tenantA, leadId: f.leadB } })).toBe(0);
  });
});

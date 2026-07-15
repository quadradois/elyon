import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { criarFollowupOutbound, processarFollowupReivindicado, reivindicarProximoFollowup } from '../../src/servicos/followup-outbound';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';
import express from 'express';
import request from 'supertest';
import rotasLeads from '../../src/rotas/leads';
import { AgendarFollowupUseCase } from '../../src/casos-de-uso/agentes/agendar-followup.usecase';

describe('B08 follow-up outbound duravel', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => { harness = new OutboundBaselineHarness(prisma, await getRedisClient()); });
  afterEach(async () => { await harness.cleanup(); });
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  const input = (f: any, overrides: Record<string, unknown> = {}) => ({ tenantId: f.tenantA, leadId: f.leadA,
    expressaoOriginal: '15/01/2027 09:00', timezoneIana: 'America/Sao_Paulo', motivo: 'Lead pediu retorno apos decisao familiar',
    mensagemEnvio: 'Mensagem customizada do follow-up',
    evidenciaPedido: 'pode me chamar em janeiro as nove', origemPedido: 'BASELINE_B08', requestId: `request-${f.runId}`, agora: new Date('2026-07-15T12:00:00Z'), ...overrides });
  const seedEvidence = (leadId: string) => prisma.mensagemProspeccao.create({ data: { leadId, direcao: 'ENTRADA', conteudo: 'pode me chamar em janeiro as nove' } });
  const apiApp = (tenantId: string) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.tenantId = tenantId; next(); });
    app.use('/api/leads', rotasLeads);
    return app;
  };

  it('concorrencia com mensagens diferentes preserva somente um agregado operacional ativo', async () => {
    const f = await harness.seed();
    await seedEvidence(f.leadA);
    const mensagens = ['Mensagem A preservada', 'Mensagem B concorrente'];
    const [a, b] = await Promise.all([
      criarFollowupOutbound(input(f, { mensagemEnvio: mensagens[0], requestId: `request-a-${f.runId}` })),
      criarFollowupOutbound(input(f, { mensagemEnvio: mensagens[1], requestId: `request-b-${f.runId}` })),
    ]);
    expect(a.success && b.success).toBe(true);
    if (!a.success || !b.success) throw new Error('criacao concorrente inesperadamente recusada');
    expect([a.deduplicado, b.deduplicado].sort()).toEqual([false, true]);
    expect((a.deduplicado ? a : b).reasonCode).toBe('FOLLOWUP_EQUIVALENTE_ATIVO');
    expect(await prisma.followupOutbound.count({ where: { tenantId: f.tenantA, leadId: f.leadA } })).toBe(1);
    const saved = await prisma.followupOutbound.findFirstOrThrow({ where: { leadId: f.leadA } });
    expect(saved).toMatchObject({ status: 'PENDENTE', timezoneIana: 'America/Sao_Paulo', policyVersion: 'followup-v1', tentativas: 0 });
    expect(mensagens).toContain(saved.mensagemEnvio);
  });

  it('persiste o payload real do ChatPanel pela API sem descartar a mensagem customizada', async () => {
    const f = await harness.seed();
    const app = apiApp(f.tenantA);
    const payload = {
      mensagem: 'Retorno personalizado combinado.',
      dataEnvio: '2027-01-15 09:30',
      timezoneIana: 'America/Sao_Paulo',
      motivo: 'Agendamento manual pelo operador autenticado',
      requestId: `request-api-${f.runId}`,
    };
    const response = await request(app).post(`/api/leads/${f.leadA}/followup`).send(payload);
    expect(response.status).toBe(200);
    const active = await request(app).get(`/api/leads/${f.leadA}/followup/ativo`);
    expect(active.body.followup).toMatchObject({ id: response.body.followupId, mensagem: payload.mensagem, dataLocal: '2027-01-15T09:30' });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: response.body.followupId } })).toMatchObject({
      tenantId: f.tenantA,
      leadId: f.leadA,
      mensagemEnvio: payload.mensagem,
      expressaoOriginal: payload.dataEnvio,
      timezoneIana: payload.timezoneIana,
      origemPedido: 'API_LEADS_FOLLOWUP',
      evidenciaPedido: 'OPERADOR_AUTENTICADO_CHAT_PANEL',
    });
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
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, conteudo: 'Mensagem customizada do follow-up' } })).toBe(1);
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

  it('API permite horario 1 -> horario 2 -> horario 1, preserva historico e replay', async () => {
    const f = await harness.seed();
    const app = apiApp(f.tenantA);
    const firstPayload = { mensagem: 'Primeiro retorno', dataEnvio: '2027-01-15 09:30', timezoneIana: 'America/Sao_Paulo', motivo: 'Agendamento manual pelo operador autenticado', requestId: `cycle-1-${f.runId}` };
    const first = await request(app).post(`/api/leads/${f.leadA}/followup`).send(firstPayload);
    expect(first.status).toBe(200);
    const secondPayload = { ...firstPayload, requestId: `cycle-2-${f.runId}`, followupId: first.body.followupId, mensagem: 'Mensagem do horario 2', dataEnvio: '2027-01-20 10:00' };
    const next = await request(app).post(`/api/leads/${f.leadA}/followup`).send(secondPayload);
    expect(next.status).toBe(200);
    const thirdPayload = { ...firstPayload, requestId: `cycle-3-${f.runId}`, followupId: next.body.followupId, mensagem: 'Nova operacao legitima no horario 1' };
    const back = await request(app).post(`/api/leads/${f.leadA}/followup`).send(thirdPayload);
    expect(back.status).toBe(200);
    const replay = await request(app).post(`/api/leads/${f.leadA}/followup`).send(thirdPayload);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ followupId: back.body.followupId, deduplicado: true, reasonCode: 'FOLLOWUP_REQUEST_REPLAY' });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: first.body.followupId } })).toMatchObject({ status: 'CANCELADO', reasonCode: 'REAGENDAMENTO' });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: next.body.followupId } })).toMatchObject({ status: 'CANCELADO', reasonCode: 'REAGENDAMENTO' });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: back.body.followupId } })).toMatchObject({ status: 'PENDENTE', mensagemEnvio: 'Nova operacao legitima no horario 1' });
    expect(await prisma.followupOutbound.count({ where: { leadId: f.leadA } })).toBe(3);
    expect(await prisma.followupOutbound.count({ where: { leadId: f.leadA, status: 'PENDENTE' } })).toBe(1);
  });

  it('caminho real do use case da tool liga followupId ao PostgreSQL', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA);
    const useCase = new AgendarFollowupUseCase();
    const base = { tenantId: f.tenantA, leadId: f.leadA, dataRecontato: '15/01/2027 09:00', timezoneIana: 'America/Sao_Paulo', motivo: 'Lead pediu retorno apos decisao familiar', mensagemEnvio: 'Primeira mensagem da tool', evidenciaPedido: 'pode me chamar em janeiro as nove', origemPedido: 'TOOL_AGENDAR_FOLLOWUP', requestId: `tool-create-${f.runId}` };
    const first = await useCase.execute(base);
    expect(first.success).toBe(true);
    if (!first.success || !first.followupId) throw new Error('follow-up inicial da tool nao criado');
    const next = await useCase.execute({ ...base, requestId: `tool-reschedule-${f.runId}`, followupId: first.followupId, dataRecontato: '20/01/2027 10:00', mensagemEnvio: 'Mensagem reagendada pela tool' });
    expect(next.success).toBe(true);
    if (!next.success || !next.followupId) throw new Error('reagendamento da tool nao criado');
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: first.followupId } })).toMatchObject({ status: 'CANCELADO', reasonCode: 'REAGENDAMENTO' });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: next.followupId } })).toMatchObject({ status: 'PENDENTE', mensagemEnvio: 'Mensagem reagendada pela tool' });
  });

  it.each([
    { reasonCode: 'DELIVERY_UNKNOWN', effect: false, expected: 'FOLLOWUP_DELIVERY_UNKNOWN' },
    { reasonCode: 'DELIVERY_RECONCILIATION_REQUIRED', effect: false, expected: 'FOLLOWUP_RECONCILIATION_REQUIRED' },
    { reasonCode: null, effect: true, expected: 'FOLLOWUP_EFFECT_RESERVED' },
  ])('reagendamento falha fechado para estado ambiguo $expected', async ({ reasonCode, effect, expected }) => {
    const f = await harness.seed();
    const app = apiApp(f.tenantA);
    const payload = { mensagem: 'Primeiro retorno', dataEnvio: '2027-01-15 09:30', timezoneIana: 'America/Sao_Paulo', motivo: 'Agendamento manual pelo operador autenticado', requestId: `ambiguous-create-${f.runId}` };
    const first = await request(app).post(`/api/leads/${f.leadA}/followup`).send(payload);
    expect(first.status).toBe(200);
    if (reasonCode) await prisma.followupOutbound.update({ where: { id: first.body.followupId }, data: { status: 'FALHO', reasonCode } });
    if (effect) await prisma.efeitoFollowupOutbound.create({ data: { followupId: first.body.followupId, fencingToken: 1, chaveIdempotencia: `reserved-${f.runId}` } });
    const response = await request(app).post(`/api/leads/${f.leadA}/followup`).send({ ...payload, requestId: `ambiguous-reschedule-${f.runId}`, followupId: first.body.followupId, dataEnvio: '2027-01-20 10:00' });
    expect(response.status).toBe(422);
    expect(response.body.erro).toBe(expected);
    expect(await prisma.followupOutbound.count({ where: { leadId: f.leadA } })).toBe(1);
    expect((await prisma.followupOutbound.findUniqueOrThrow({ where: { id: first.body.followupId } })).status).not.toBe('CANCELADO');
  });

  it('retry usa tentativas no backoff e encerra ao atingir o limite', async () => {
    const previous = process.env.FOLLOWUP_MAX_ATTEMPTS;
    process.env.FOLLOWUP_MAX_ATTEMPTS = '3';
    const f = await harness.seed(); await seedEvidence(f.leadA); const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const transient = Object.assign(new Error('PROVIDER_UNAVAILABLE'), { definitiveNoSend: true });
    try {
      for (const [attempt, expectedBackoff] of [[1, 30_000], [2, 60_000], [3, null]] as const) {
        const claimed = await reivindicarProximoFollowup(`retry-owner-${attempt}`);
        expect(claimed?.tentativas).toBe(attempt);
        const failureAt = new Date();
        expect(await processarFollowupReivindicado(claimed!, `retry-owner-${attempt}`, { send: async () => { throw transient; } }, failureAt)).toBe('FALHO');
        const saved = await prisma.followupOutbound.findUniqueOrThrow({ where: { id: created.followup.id } });
        if (expectedBackoff === null) expect(saved).toMatchObject({ status: 'FALHO', reasonCode: 'RETRY_EXHAUSTED', proximoRetryEm: null });
        else {
          expect(saved.reasonCode).toBe('DELIVERY_TRANSIENT');
          expect(saved.proximoRetryEm?.getTime()).toBe(failureAt.getTime() + expectedBackoff);
          await prisma.followupOutbound.update({ where: { id: saved.id }, data: { proximoRetryEm: new Date(Date.now() - 1) } });
        }
      }
      expect(await reivindicarProximoFollowup('must-not-retry-exhausted')).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.FOLLOWUP_MAX_ATTEMPTS; else process.env.FOLLOWUP_MAX_ATTEMPTS = previous;
    }
  });

  it('resultado ambiguo fica fail-closed sem novo claim', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA); const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const claimed = await reivindicarProximoFollowup('ambiguous-owner');
    await processarFollowupReivindicado(claimed!, 'ambiguous-owner', { send: async () => { throw new Error('PROVIDER_TIMEOUT'); } });
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: created.followup.id } })).toMatchObject({ status: 'FALHO', reasonCode: 'DELIVERY_UNKNOWN', proximoRetryEm: null });
    expect(await reivindicarProximoFollowup('must-not-retry-ambiguous')).toBeNull();
  });

  it('crash apos envio antes da confirmacao fica fail-closed sem resposta fantasma ou reenvio', async () => {
    const f = await harness.seed(); await seedEvidence(f.leadA); const created = await criarFollowupOutbound(input(f)); if (!created.success) throw new Error(created.reasonCode);
    await prisma.followupOutbound.update({ where: { id: created.followup.id }, data: { agendadoParaUtc: new Date(Date.now() - 1000) } });
    const first = await reivindicarProximoFollowup('crash-owner'); let sends = 0; let takeover: Awaited<ReturnType<typeof reivindicarProximoFollowup>> = null;
    await processarFollowupReivindicado(first!, 'crash-owner', { send: async () => {
      sends++;
      await prisma.followupOutbound.update({ where: { id: first!.id }, data: { leaseAte: new Date(Date.now() - 1000) } });
      takeover = await reivindicarProximoFollowup('takeover-owner');
      return { providerId: 'sent-before-crash' };
    } });
    expect(sends).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, conteudo: 'Mensagem customizada do follow-up' } })).toBe(0);
    expect(await prisma.efeitoFollowupOutbound.findUniqueOrThrow({ where: { followupId: first!.id } })).toMatchObject({ status: 'RESERVADO' });
    expect(takeover).not.toBeNull();
    expect(await processarFollowupReivindicado(takeover!, 'takeover-owner', { send: async () => { sends++; return {}; } })).toBe('FALHO');
    expect(sends).toBe(1);
    expect(await prisma.followupOutbound.findUniqueOrThrow({ where: { id: first!.id } })).toMatchObject({ status: 'FALHO', reasonCode: 'DELIVERY_RECONCILIATION_REQUIRED', proximoRetryEm: null });
  });

  it('isola tenants com telefone igual', async () => {
    const f = await harness.seed();
    await Promise.all([seedEvidence(f.leadA), seedEvidence(f.leadB)]);
    await Promise.all([criarFollowupOutbound(input(f)), criarFollowupOutbound(input(f, { tenantId: f.tenantB, leadId: f.leadB }))]);
    expect(await prisma.followupOutbound.count()).toBe(2);
    expect(await prisma.followupOutbound.count({ where: { tenantId: f.tenantA, leadId: f.leadB } })).toBe(0);
  });
});

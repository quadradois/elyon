jest.mock('../../src/servicos/servico-captura-documentos', () => ({ detectarTipoMidia: jest.fn(() => null), capturarDocumentoWhatsapp: jest.fn() }));
jest.mock('../../src/servicos/servico-analise-midia', () => ({ analisarMidiaParaContexto: jest.fn(async () => null) }));
jest.mock('../../src/servicos/servico-voz', () => ({ sintetizarFalaTenant: jest.fn(async () => null) }));
jest.mock('../../src/servicos/rag-conversas', () => ({ ragConversasService: { buscarContextoRelevante: jest.fn(async (tenantId: string, leadId: string) => ({ contextoFormatado: 'RAG_FATO_SINTETICO', facts: [{ contractVersion: '1.0', id: 'fact-1', conteudo: 'RAG_FATO_SINTETICO', origem: 'baseline', recuperadoEm: '2026-01-01T00:00:00.000Z', confianca: 0.95, tenantId, leadId, relevancia: 0.9 }] })) } }));
jest.mock('../../src/casos-de-uso/agentes/qualificar-lead.usecase', () => ({ QualificarLeadUseCase: class { execute = jest.fn(async () => ({ success: false })); } }));
jest.mock('../../src/casos-de-uso/agentes/converter-para-lead.usecase', () => ({ ConverterParaLeadUseCase: class { execute = jest.fn(async () => ({ success: false })); } }));
jest.mock('../../src/agentes/orchestrator', () => {
  const doubles = require('./support/deterministic-doubles');
  return {
    processarMensagemOrquestrada: doubles.deterministicOrchestrator,
    buscarConfiguracaoTenant: jest.fn(async (tenantId: string) => ({ tenantId })),
    buscarContextoConversa: jest.fn(async () => ({ qualificationPolicyVersion: 'spin-candidate-v1' })),
    resolverLeadIdCanonico: jest.fn(async (telefone: string, tenantId: string) => {
      const { prisma } = require('../../src/lib/db');
      const leads = await prisma.lead.findMany({
        where: { telefone: { contains: telefone.replace(/\D/g, '').slice(-11) }, tenantId },
        select: { id: true },
      });
      return leads.length === 1 ? leads[0].id : null;
    }),
  };
});
jest.mock('../../src/servicos/whatsapp', () => {
  const { captured } = require('./support/deterministic-doubles');
  return { getWhatsAppService: jest.fn(() => ({
    enviarIndicadorDigitando: jest.fn(async () => undefined),
    enviarMensagemTexto: jest.fn(async (phone: string, body: string) => { captured.sent.push({ phone, body }); return { key: { id: `det-${captured.sent.length}` } }; }),
    enviarMensagemAudio: jest.fn(async () => ({ key: { id: 'det-audio' } })),
    enviarMidia: jest.fn(async () => ({ key: { id: 'det-media' } })),
  })) };
});

import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { reivindicarProximoEvento } from '../../src/servicos/webhook-inbox';
import { disparoCampanhaService } from '../../src/servicos/disparo-campanha';
import { captured, resetDoubles } from './support/deterministic-doubles';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('baseline do caminho real inbox → executor → handler Evolution', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => { OutboundBaselineHarness.assertDedicatedInfrastructure(); harness = new OutboundBaselineHarness(prisma, await getRedisClient()); });
  afterEach(async () => { await harness.cleanup(); resetDoubles(); });
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  it('B01 usa seletor e serviço reais para persistir o primeiro disparo uma vez', async () => {
    const f = await harness.seed();
    await prisma.lead.update({ where: { id: f.leadA }, data: { statusProspeccao: 'AGUARDANDO' } });
    const [eligible] = await disparoCampanhaService.buscarContatosParaDisparo(f.campaignA, 10);
    expect(eligible.id).toBe(f.leadA);
    const campaign = await prisma.campanha.findUniqueOrThrow({ where: { id: f.campaignA } });
    await expect(disparoCampanhaService.enviarMensagem(eligible, campaign)).resolves.toEqual(expect.objectContaining({ sucesso: true }));
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, direcao: 'SAIDA' } })).toBe(2);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: f.leadA } })).tentativasContato).toBe(1);
  });

  it('B02/B03/B06/B15 processa recibo real e resolve Lead pelo tenant da sessão', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `trusted-${f.runId}`, 'qualificar com evidências', { maliciousTenantId: f.tenantB });
    await expect(harness.runWorkerAndBatch('real-worker')).resolves.toBe('CONCLUIDO');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, direcao: 'ENTRADA' } })).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadB } })).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: f.leadB } })).statusProspeccao).toBe('CONTATANDO');

    await harness.acceptInbound(f, `foreign-${f.runId}`, 'qualificar com evidências', { instanceName: f.instanceB, maliciousTenantId: f.tenantA });
    await expect(harness.runWorkerAndBatch('foreign-worker')).resolves.toBe('CONCLUIDO');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, messageId: `foreign-${f.runId}` } })).toBe(0);
  });

  it('B06 preserva Lead, histórico e resposta única após qualificação', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `continuity-1-${f.runId}`, 'primeiro inbound');
    await harness.runWorkerAndBatch('continuity-worker-1');
    await prisma.lead.update({
      where: { id: f.leadA },
      data: { status: 'QUALIFICADO', statusProspeccao: null },
    });

    await harness.acceptInbound(f, `continuity-2-${f.runId}`, 'próximo inbound');
    await harness.runWorkerAndBatch('continuity-worker-2');

    expect(await prisma.mensagemProspeccao.count({
      where: { leadId: f.leadA, direcao: 'ENTRADA' },
    })).toBe(2);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadB } })).toBe(0);
    expect(await prisma.conversa.count({ where: { leadId: f.leadA } })).toBe(1);
    expect(captured.sent).toHaveLength(2);
  });

  it('B04 consolida mensagens sequenciais em ordem e executa o agente uma vez', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `b04-1-${f.runId}`, 'primeiro fragmento');
    await harness.acceptInbound(f, `b04-2-${f.runId}`, 'segundo fragmento');
    // Um unico loop serial ingere ambos os recibos antes de executar o claimer.
    await harness.runWorkerOnce('b04-single-loop');
    await harness.runWorkerOnce('b04-single-loop');
    await harness.runBatchOnce('b04-single-loop');
    expect(captured.orchestrator).toHaveLength(1);
    expect(JSON.stringify(captured.orchestrator[0].messages)).toContain('primeiro fragmento');
    expect(JSON.stringify(captured.orchestrator[0].messages)).toContain('segundo fragmento');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, direcao: 'ENTRADA' } })).toBe(2);
    expect(await prisma.loteMensagemInbound.count({ where: { tenantId: f.tenantA, leadId: f.leadA, status: 'CONCLUIDO' } })).toBe(1);
    expect(captured.sent).toHaveLength(1);
  });

  it.each([
    ['HUMANO', 'CONTATANDO'],
    ['IA', 'OPTOUT'],
  ])('B04 bloqueia resposta se modo/outreach mudar durante a janela (%s/%s)', async (modoAtendimento, statusProspeccao) => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `guard-${modoAtendimento}-${f.runId}`, 'mensagem antes da intervencao');
    await harness.runWorkerOnce(`guard-worker-${modoAtendimento}`);
    await prisma.lead.update({ where: { id: f.leadA }, data: { modoAtendimento, statusProspeccao } });
    await harness.runBatchOnce(`guard-worker-${modoAtendimento}`);
    expect(captured.orchestrator).toHaveLength(0);
    expect(captured.sent).toHaveLength(0);
    expect(await prisma.loteMensagemInbound.count({ where: { leadId: f.leadA, status: 'CANCELADO' } })).toBe(1);
  });

  it('SEC-52 rejeita permanentemente instância Evolution sem sessão reconhecida', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `unknown-${f.runId}`, 'qualificar com evidências', { instanceName: `unknown-${f.runId}` });
    await expect(harness.runWorkerOnce('unknown-instance-worker')).resolves.toBe('MORTO');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: { in: [f.leadA, f.leadB] }, messageId: `unknown-${f.runId}` } })).toBe(0);
    expect(await prisma.webhookEvento.findFirst({ where: { eventoId: `unknown-${f.runId}` } })).toEqual(expect.objectContaining({ status: 'MORTO' }));
  });

  it('B07/B17 exige policy/evidências e não promove o estágio comercial', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `policy-${f.runId}`, 'qualificar com evidências');
    await harness.runWorkerAndBatch('policy-worker');
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: f.leadA } });
    expect(lead.schemaState).toEqual({ qualificationPolicyVersion: 'spin-candidate-v1', evidence: { situation: true, motivation: true } });
    expect(lead.status).toBe('NOVO');
    expect(await prisma.atividade.count({ where: { leadId: f.leadA, titulo: 'TOOL_EXEC:QUALIFY' } })).toBe(1);
  });

  it('B09 recusa intenção de agenda sem dia, hora e timezone', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `schedule-${f.runId}`, 'quero agendar uma visita');
    await harness.runWorkerAndBatch('schedule-worker');
    expect(await prisma.atividade.count({ where: { leadId: f.leadA, tipo: 'AVALIACAO' } })).toBe(0);
  });

  it('B10 aplica opt-out e o seletor real bloqueia novo disparo', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `optout-${f.runId}`, 'opt-out agora');
    await harness.runWorkerAndBatch('optout-worker');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: f.leadA } })).statusProspeccao).toBe('OPTOUT');
    expect(await disparoCampanhaService.buscarContatosParaDisparo(f.campaignA, 10)).toHaveLength(0);
    expect(captured.sent).toHaveLength(1);
  });

  it('B11 persiste inbound, mas bloqueia orquestrador e resposta em modo HUMANO', async () => {
    const f = await harness.seed();
    await prisma.lead.update({ where: { id: f.leadA }, data: { modoAtendimento: 'HUMANO' } });
    await harness.acceptInbound(f, `human-${f.runId}`, 'qualificar com evidências');
    await harness.runWorkerAndBatch('human-worker');
    expect(captured.orchestrator).toHaveLength(0);
    expect(captured.sent).toHaveLength(0);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, direcao: 'ENTRADA' } })).toBe(1);
  });

  it('B12 replay mantém contagens e efeitos únicos', async () => {
    const f = await harness.seed(); const eventId = `replay-${f.runId}`;
    expect((await harness.acceptInbound(f, eventId, 'qualificar com evidências')).duplicado).toBe(false);
    await harness.runWorkerAndBatch('replay-worker');
    expect((await harness.acceptInbound(f, eventId, 'qualificar com evidências')).duplicado).toBe(true);
    expect(await prisma.webhookEvento.count({ where: { eventoId: eventId } })).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: f.leadA, messageId: eventId } })).toBe(1);
  });

  it('B13 executor real retoma lease expirado após restart', async () => {
    const f = await harness.seed(); const eventId = `restart-${f.runId}`;
    await harness.acceptInbound(f, eventId, 'quero informações');
    expect(await reivindicarProximoEvento('worker-crashed')).not.toBeNull();
    await harness.expireLease(eventId);
    await harness.runWorkerOnce('worker-restarted');
    expect(await prisma.webhookEvento.findFirst({ where: { eventoId: eventId } })).toEqual(expect.objectContaining({ status: 'CONCLUIDO', tentativas: 2 }));
  });

  it('B14 falha no meio do comando reverte todas as mutações da transação', async () => {
    const f = await harness.seed(); captured.failMidCommand = true;
    await harness.acceptInbound(f, `rollback-${f.runId}`, 'falhar comando');
    await expect(harness.runWorkerOnce('rollback-worker')).resolves.toBe('CONCLUIDO');
    await harness.runBatchOnce('rollback-worker:batch');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: f.leadA } })).observacoes).toBeNull();
    expect(await prisma.atividade.count({ where: { leadId: f.leadA, titulo: 'TOOL_EXEC:FAIL' } })).toBe(0);
    expect(await prisma.loteMensagemInbound.count({ where: { leadId: f.leadA, status: 'FALHO' } })).toBe(1);
    expect(captured.sent).toHaveLength(0);
  });
});

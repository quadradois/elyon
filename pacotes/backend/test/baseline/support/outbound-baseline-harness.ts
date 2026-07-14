import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RedisClientType } from 'redis';
import type { prisma as applicationPrisma } from '../../../src/lib/db';
import { registrarEventoWebhook } from '../../../src/servicos/webhook-seguranca';
import {
  concluirTentativa,
  falharTentativa,
  reivindicarProximoEvento,
} from '../../../src/servicos/webhook-inbox';

export interface BaselineClock {
  now(): Date;
  advance(ms: number): void;
}

export class ControlledClock implements BaselineClock {
  constructor(private value = new Date('2026-01-15T12:00:00.000Z')) {}
  now(): Date { return new Date(this.value); }
  advance(ms: number): void { this.value = new Date(this.value.getTime() + ms); }
}

export class DeterministicEvolutionDouble {
  readonly sent: Array<{ tenantId: string; leadId: string; body: string; messageId: string }> = [];

  send(input: { tenantId: string; leadId: string; body: string }): string {
    const messageId = `evo-${createHash('sha256').update(`${input.tenantId}:${input.leadId}:${input.body}`).digest('hex').slice(0, 16)}`;
    if (!this.sent.some((item) => item.messageId === messageId)) this.sent.push({ ...input, messageId });
    return messageId;
  }
}

export class DeterministicExternalDoubles {
  readonly agenda: Array<{ leadId: string; at: Date }> = [];
  readonly voice: string[] = [];
  readonly llmCalls: string[] = [];
  constructor(readonly evolution = new DeterministicEvolutionDouble()) {}

  agent(input: string): { command: 'QUALIFY' | 'FOLLOW_UP' | 'OPT_OUT' | 'SCHEDULE' | 'NONE'; evidence?: Prisma.InputJsonValue } {
    this.llmCalls.push(input);
    const normalized = input.toLowerCase();
    if (normalized.includes('sair') || normalized.includes('não quero')) return { command: 'OPT_OUT' };
    if (normalized.includes('amanhã às 14')) return { command: 'SCHEDULE' };
    if (normalized.includes('fale comigo depois')) return { command: 'FOLLOW_UP' };
    if (normalized.includes('imóvel vazio') && normalized.includes('vender')) {
      return { command: 'QUALIFY', evidence: { policy: 'spin-candidate-v1', motivation: true, situation: true } };
    }
    return { command: 'NONE' };
  }
}

export interface BaselineFixture {
  runId: string;
  tenantA: string;
  tenantB: string;
  campaignA: string;
  leadA: string;
  leadB: string;
  sessionA: string;
}

export class OutboundBaselineHarness {
  readonly runId = randomUUID();
  readonly redisKeys = new Set<string>();
  readonly eventIds = new Set<string>();
  readonly tenantIds = new Set<string>();

  constructor(
    readonly db: typeof applicationPrisma,
    readonly redis: RedisClientType,
    readonly clock = new ControlledClock(),
    readonly doubles = new DeterministicExternalDoubles(),
  ) {}

  static assertDedicatedInfrastructure(): void {
    const databaseUrl = process.env.DATABASE_URL || '';
    const redisUrl = process.env.REDIS_URL || '';
    if (!/elyon_integration(?:\?|$)/.test(databaseUrl)) throw new Error('baseline exige banco dedicado elyon_integration');
    if (!/\/15(?:\?|$)/.test(redisUrl)) throw new Error('baseline exige Redis dedicado /15');
    if (process.env.NODE_ENV !== 'test') throw new Error('baseline somente pode executar com NODE_ENV=test');
  }

  async seed(): Promise<BaselineFixture> {
    const tenantA = await this.db.tenant.create({ data: { nome: 'Baseline Tenant A', slug: `baseline-a-${this.runId}` } });
    const tenantB = await this.db.tenant.create({ data: { nome: 'Baseline Tenant B', slug: `baseline-b-${this.runId}` } });
    this.tenantIds.add(tenantA.id); this.tenantIds.add(tenantB.id);
    const campaignA = await this.db.campanha.create({ data: { tenantId: tenantA.id, nome: 'Baseline outbound', status: 'ATIVA' } });
    const sessionA = await this.db.sessaoWhatsapp.create({ data: {
      tenantId: tenantA.id, nome: 'Baseline', instanceName: `baseline-${this.runId}`,
      evolutionInstanceId: `instance-${this.runId}`, evolutionToken: `token-${this.runId}`, status: 'CONECTADO',
    } });
    const common = { doresIdentificadas: [], objecoes: [], imovelCaracteristicas: [], imovelFotos: [] };
    const leadA = await this.db.lead.create({ data: {
      ...common, tenantId: tenantA.id, nome: 'Synthetic A', telefone: '5500000000001',
      campanhaOrigemId: campaignA.id, statusProspeccao: 'AGUARDANDO', modoAtendimento: 'IA',
    } });
    const leadB = await this.db.lead.create({ data: {
      ...common, tenantId: tenantB.id, nome: 'Synthetic B', telefone: '5500000000001',
      statusProspeccao: 'AGUARDANDO', modoAtendimento: 'IA',
    } });
    return { runId: this.runId, tenantA: tenantA.id, tenantB: tenantB.id, campaignA: campaignA.id, leadA: leadA.id, leadB: leadB.id, sessionA: sessionA.id };
  }

  async dispatchOnce(fixture: BaselineFixture): Promise<string> {
    const lead = await this.db.lead.findFirstOrThrow({ where: {
      id: fixture.leadA, tenantId: fixture.tenantA, campanhaOrigemId: fixture.campaignA,
      statusProspeccao: 'AGUARDANDO', modoAtendimento: 'IA',
    } });
    const body = 'Mensagem sintética determinística de prospecção';
    const messageId = this.doubles.evolution.send({ tenantId: fixture.tenantA, leadId: lead.id, body });
    await this.db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: lead.id }, data: { statusProspeccao: 'CONTATANDO', tentativasContato: { increment: 1 }, ultimaTentativa: this.clock.now() } });
      await tx.mensagemProspeccao.create({ data: { leadId: lead.id, direcao: 'SAIDA', conteudo: body, telefone: lead.telefone, messageId } });
    });
    return messageId;
  }

  async acceptInbound(fixture: BaselineFixture, eventId: string, content: string): Promise<{ duplicate: boolean; receiptId?: string }> {
    this.eventIds.add(eventId);
    const payload = { instanceName: `baseline-${fixture.runId}`, instanceId: `instance-${fixture.runId}`, tenantId: fixture.tenantA, phone: '5500000000001', content };
    const result = await registrarEventoWebhook({ provedor: 'EVOLUTION', eventoId: eventId, tipo: 'messages.upsert', payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), payload });
    return { duplicate: result.duplicado, receiptId: result.registroId };
  }

  async runWorkerOnce(fixture: BaselineFixture, owner: string, options: { fail?: boolean } = {}): Promise<void> {
    const event = await reivindicarProximoEvento(owner);
    if (!event) throw new Error('evento esperado não foi reivindicado');
    if (options.fail) { await falharTentativa(event, 'deterministic tool failure', false, owner); return; }
    const payload = event.payload as { tenantId?: string; phone?: string; content?: string };
    const lead = await this.db.lead.findFirst({ where: { tenantId: fixture.tenantA, telefone: payload.phone } });
    if (!lead || payload.tenantId !== fixture.tenantA) throw new Error('tenant/lead não resolvido de forma confiável');
    if (lead.modoAtendimento !== 'IA' || lead.statusProspeccao === 'OPTOUT') { await concluirTentativa(event, owner); return; }
    const inboundKey = `baseline:inbound:${event.eventoId}`;
    this.redisKeys.add(inboundKey);
    const first = await this.redis.set(inboundKey, '1', { NX: true, EX: 300 });
    if (!first) { await concluirTentativa(event, owner); return; }
    const decision = this.doubles.agent(payload.content || '');
    await this.db.$transaction(async (tx) => {
      await tx.mensagemProspeccao.create({ data: { leadId: lead.id, direcao: 'ENTRADA', conteudo: payload.content || '', messageId: event.eventoId, telefone: payload.phone, processadaPorIA: true, toolsChamadas: [decision.command] } });
      if (decision.command === 'QUALIFY') await tx.lead.update({ where: { id: lead.id }, data: { statusProspeccao: 'LEAD', respondeu: true, manifestouInteresse: true, schemaState: { qualificationPolicyVersion: 'spin-candidate-v1', evidence: decision.evidence } } });
      if (decision.command === 'FOLLOW_UP') await tx.lead.update({ where: { id: lead.id }, data: { statusProspeccao: 'MORNO_FUTURO', dataRecontato: new Date(this.clock.now().getTime() + 86_400_000), motivoRecontato: 'pedido explícito sintético' } });
      if (decision.command === 'OPT_OUT') await tx.lead.update({ where: { id: lead.id }, data: { statusProspeccao: 'OPTOUT' } });
      if (decision.command === 'SCHEDULE') await tx.atividade.create({ data: { leadId: lead.id, tipo: 'AVALIACAO', titulo: 'Avaliação sintética', agendadoPara: new Date('2026-01-16T17:00:00.000Z') } });
    });
    await concluirTentativa(event, owner);
  }

  async expireLease(eventId: string): Promise<void> {
    await this.db.webhookEvento.updateMany({ where: { eventoId: eventId }, data: { status: 'PROCESSANDO', leaseAte: new Date(this.clock.now().getTime() - 1_000), leaseOwner: 'dead-worker' } });
  }

  async cleanup(): Promise<void> {
    if (this.eventIds.size) await this.db.webhookEvento.deleteMany({ where: { eventoId: { in: [...this.eventIds] } } });
    if (this.tenantIds.size) await this.db.tenant.deleteMany({ where: { id: { in: [...this.tenantIds] } } });
    if (this.redisKeys.size) await this.redis.del([...this.redisKeys]);
    this.eventIds.clear(); this.tenantIds.clear(); this.redisKeys.clear();
    this.doubles.evolution.sent.splice(0);
    this.doubles.llmCalls.splice(0);
    this.doubles.agenda.splice(0);
    this.doubles.voice.splice(0);
  }
}

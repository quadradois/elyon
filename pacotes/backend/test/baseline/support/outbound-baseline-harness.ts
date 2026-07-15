import { createHash, randomUUID } from 'crypto';
import type { prisma as applicationPrisma } from '../../../src/lib/db';
import { RedisClientType } from 'redis';
import { registrarEventoWebhook } from '../../../src/servicos/webhook-seguranca';
import { reivindicarProximoEvento } from '../../../src/servicos/webhook-inbox';
import { executarEventoWebhook } from '../../../src/servicos/webhook-worker-executor';
import { executarProximoLoteInbound } from '../../../src/servicos/processador-lotes-inbound';

export interface BaselineFixture {
  runId: string;
  tenantA: string;
  tenantB: string;
  campaignA: string;
  leadA: string;
  leadB: string;
  instanceA: string;
  instanceB: string;
}

export class OutboundBaselineHarness {
  readonly runId = randomUUID();
  readonly eventIds = new Set<string>();
  readonly tenantIds = new Set<string>();

  constructor(readonly db: typeof applicationPrisma, readonly redis: RedisClientType) {}

  static assertDedicatedInfrastructure(): void {
    if (!/elyon_integration(?:\?|$)/.test(process.env.DATABASE_URL || '')) throw new Error('baseline exige banco dedicado elyon_integration');
    if (!/\/15(?:\?|$)/.test(process.env.REDIS_URL || '')) throw new Error('baseline exige Redis dedicado /15');
    if (process.env.NODE_ENV !== 'test') throw new Error('baseline somente pode executar com NODE_ENV=test');
  }

  async seed(): Promise<BaselineFixture> {
    const tenantA = await this.db.tenant.create({ data: { nome: 'Baseline Tenant A', slug: `baseline-a-${this.runId}` } });
    const tenantB = await this.db.tenant.create({ data: { nome: 'Baseline Tenant B', slug: `baseline-b-${this.runId}` } });
    this.tenantIds.add(tenantA.id); this.tenantIds.add(tenantB.id);
    const campaignA = await this.db.campanha.create({ data: { tenantId: tenantA.id, nome: 'Baseline outbound', status: 'ATIVA', briefingCompleto: 'BRIEFING_SINTETICO_CONFIAVEL' } });
    const instanceA = `baseline-a-${this.runId}`;
    const instanceB = `baseline-b-${this.runId}`;
    const sessionA = await this.db.sessaoWhatsapp.create({ data: { tenantId: tenantA.id, nome: 'Baseline A', instanceName: instanceA, evolutionInstanceId: `instance-a-${this.runId}`, evolutionToken: `token-a-${this.runId}`, status: 'CONECTADO' } });
    await this.db.sessaoWhatsapp.create({ data: { tenantId: tenantB.id, nome: 'Baseline B', instanceName: instanceB, evolutionInstanceId: `instance-b-${this.runId}`, evolutionToken: `token-b-${this.runId}`, status: 'CONECTADO' } });
    await this.db.configuracaoAgente.create({ data: {
      tenantId: tenantA.id, sessaoWhatsappId: sessionA.id, nome: 'Agente baseline',
      personalidade: {}, expertise: {}, scripts: {}, regrasNegocio: {},
      ragPerfilTexto: 'FATO_PERSISTIDO_SINTETICO', status: 'ATIVO', estaAtivo: true,
    } });
    const common = { doresIdentificadas: [], objecoes: [], imovelCaracteristicas: [], imovelFotos: [] };
    const leadA = await this.db.lead.create({ data: { ...common, tenantId: tenantA.id, nome: 'Synthetic A', telefone: '5500000000001', campanhaOrigemId: campaignA.id, statusProspeccao: 'CONTATANDO', modoAtendimento: 'IA', situacaoAtual: 'FATO_LEAD_SINTETICO' } });
    const leadB = await this.db.lead.create({ data: { ...common, tenantId: tenantB.id, nome: 'Synthetic B', telefone: '5500000000001', statusProspeccao: 'CONTATANDO', modoAtendimento: 'IA' } });
    await this.db.mensagemProspeccao.create({ data: { leadId: leadA.id, direcao: 'SAIDA', conteudo: 'HISTORICO_SINTETICO', messageId: `history-${this.runId}` } });
    return { runId: this.runId, tenantA: tenantA.id, tenantB: tenantB.id, campaignA: campaignA.id, leadA: leadA.id, leadB: leadB.id, instanceA, instanceB };
  }

  async acceptInbound(fixture: BaselineFixture, eventId: string, content: string, options: { instanceName?: string; maliciousTenantId?: string } = {}) {
    this.eventIds.add(eventId);
    const payload = {
      event: 'messages.upsert',
      instanceName: options.instanceName || fixture.instanceA,
      tenantId: options.maliciousTenantId,
      data: {
        Info: { Chat: '5500000000001@s.whatsapp.net', IsFromMe: false, ID: eventId, Timestamp: new Date().toISOString() },
        Message: { conversation: content },
      },
    };
    return registrarEventoWebhook({ provedor: 'EVOLUTION', eventoId: eventId, tipo: 'messages.upsert', payloadHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), payload });
  }

  async runWorkerOnce(owner: string): Promise<'CONCLUIDO' | 'RETRY' | 'MORTO'> {
    const event = await reivindicarProximoEvento(owner);
    if (!event) throw new Error('evento esperado não foi reivindicado');
    return executarEventoWebhook(event, owner);
  }

  async runBatchOnce(owner: string): Promise<boolean> {
    await this.db.loteMensagemInbound.updateMany({
      where: { tenantId: { in: [...this.tenantIds] }, status: { in: ['ABERTO', 'FALHO'] } },
      data: { fechaEm: new Date(Date.now() - 1) },
    });
    return executarProximoLoteInbound(owner);
  }

  async runWorkerAndBatch(owner: string): Promise<'CONCLUIDO' | 'RETRY' | 'MORTO'> {
    const result = await this.runWorkerOnce(owner);
    if (result === 'CONCLUIDO') await this.runBatchOnce(`${owner}:batch`);
    return result;
  }

  async expireLease(eventId: string): Promise<void> {
    await this.db.webhookEvento.updateMany({ where: { eventoId: eventId }, data: { status: 'PROCESSANDO', leaseAte: new Date(Date.now() - 1_000), leaseOwner: 'dead-worker' } });
  }

  async cleanup(): Promise<void> {
    if (this.eventIds.size) await this.db.webhookEvento.deleteMany({ where: { eventoId: { in: [...this.eventIds] } } });
    if (this.tenantIds.size) await this.db.tenant.deleteMany({ where: { id: { in: [...this.tenantIds] } } });
    await this.redis.flushDb();
    this.eventIds.clear(); this.tenantIds.clear();
  }
}

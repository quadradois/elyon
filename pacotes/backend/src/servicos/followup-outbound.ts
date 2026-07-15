import os from 'os';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { followupAtraso, followupEventos } from '../observabilidade/followup-outbound-metrics';
import { FOLLOWUP_POLICY_VERSION, interpretarFollowupTemporal } from './followup-temporal';

export type FollowupStatus = 'PENDENTE' | 'REIVINDICADO' | 'EXECUTADO' | 'CANCELADO' | 'EXPIRADO' | 'FALHO';
export const FOLLOWUP_OWNER = `${os.hostname()}:${process.pid}`;
const ACTIVE: FollowupStatus[] = ['PENDENTE', 'REIVINDICADO', 'FALHO'];

function normalizarMotivo(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash(parts: string[]): string { return createHash('sha256').update(parts.join('|')).digest('hex'); }
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/^[A-Z][A-Z0-9_:-]{2,80}/)?.[0] || 'FOLLOWUP_PROCESSING_FAILED';
}
function backoffMs(attempt: number): number { return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1)); }

export interface CriarFollowupInput {
  tenantId: string; leadId: string; expressaoOriginal: string; timezoneIana: string;
  motivo: string; evidenciaPedido: string; origemPedido: string; policyVersion?: string; agora?: Date;
}

export async function criarFollowupOutbound(input: CriarFollowupInput) {
  const policyVersion = input.policyVersion || FOLLOWUP_POLICY_VERSION;
  if (policyVersion !== FOLLOWUP_POLICY_VERSION) return { success: false as const, reasonCode: 'POLICY_VERSION_INVALID' };
  const motivoNormalizado = normalizarMotivo(input.motivo || '');
  if (motivoNormalizado.length < 3) return { success: false as const, reasonCode: 'MOTIVO_REQUIRED' };
  if (!input.evidenciaPedido?.trim()) return { success: false as const, reasonCode: 'EVIDENCIA_REQUIRED' };
  if (!input.origemPedido?.trim()) return { success: false as const, reasonCode: 'ORIGEM_REQUIRED' };
  if (!['TOOL_AGENDAR_FOLLOWUP', 'API_LEADS_FOLLOWUP', 'BASELINE_B08'].includes(input.origemPedido)) return { success: false as const, reasonCode: 'ORIGEM_INVALID' };
  const temporal = interpretarFollowupTemporal({ expressao: input.expressaoOriginal, timezone: input.timezoneIana, agora: input.agora });
  if (!temporal.ok) return { success: false as const, reasonCode: temporal.reasonCode };
  const chaveIdempotencia = hash([input.tenantId, input.leadId, temporal.utc.toISOString(), motivoNormalizado, policyVersion]);

  let result: { followup: any; deduplicado: boolean } | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.tenantId}:${input.leadId}:followup`}, 0))`;
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, tenantId: input.tenantId }, select: { id: true } });
    if (!lead) throw new Error('TENANT_OWNERSHIP_DENIED');
    const evidence = await tx.mensagemProspeccao.findFirst({ where: { leadId: input.leadId, direcao: 'ENTRADA', conteudo: { contains: input.evidenciaPedido.trim(), mode: 'insensitive' } }, select: { id: true } });
    if (!evidence) throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    const existing = await tx.followupOutbound.findUnique({ where: { chaveIdempotencia } });
    if (existing) return { followup: existing, deduplicado: true };
    const followup = await tx.followupOutbound.create({ data: {
      tenantId: input.tenantId, leadId: input.leadId, agendadoParaUtc: temporal.utc,
      timezoneIana: temporal.timezone, expressaoOriginal: input.expressaoOriginal,
      motivo: input.motivo.trim(), motivoNormalizado, policyVersion, chaveIdempotencia,
      origemPedido: input.origemPedido.trim(), evidenciaPedido: input.evidenciaPedido.trim(),
    } });
    await tx.lead.update({ where: { id: input.leadId }, data: { dataRecontato: temporal.utc, motivoRecontato: input.motivo.trim() } });
    return { followup, deduplicado: false };
      }, { isolationLevel: 'Serializable' });
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt === 3) throw error;
    }
  }
  if (!result) throw new Error('FOLLOWUP_CREATE_RETRY_EXHAUSTED');
  followupEventos.inc({ resultado: result.deduplicado ? 'deduplicado' : 'criado' });
  return { success: true as const, ...result };
}

export async function cancelarFollowupOutbound(params: { tenantId: string; leadId: string; followupId?: string; reasonCode: string }) {
  const updated = await prisma.followupOutbound.updateMany({
    where: { tenantId: params.tenantId, leadId: params.leadId, ...(params.followupId ? { id: params.followupId } : {}), status: { in: ACTIVE } },
    data: { status: 'CANCELADO', reasonCode: params.reasonCode, canceladoEm: new Date(), leaseOwner: null, leaseAte: null },
  });
  if (updated.count) followupEventos.inc({ resultado: 'cancelado' }, updated.count);
  return updated.count;
}

export async function reagendarFollowupOutbound(params: CriarFollowupInput & { followupId: string }) {
  const temporal = interpretarFollowupTemporal({ expressao: params.expressaoOriginal, timezone: params.timezoneIana, agora: params.agora });
  const motivoNormalizado = normalizarMotivo(params.motivo || '');
  if (!temporal.ok) return { success: false as const, reasonCode: temporal.reasonCode };
  if (!motivoNormalizado || !params.evidenciaPedido?.trim() || !params.origemPedido?.trim()) return { success: false as const, reasonCode: 'CONTRACT_INVALID' };
  const policyVersion = params.policyVersion || FOLLOWUP_POLICY_VERSION;
  if (policyVersion !== FOLLOWUP_POLICY_VERSION || !['TOOL_AGENDAR_FOLLOWUP', 'API_LEADS_FOLLOWUP', 'BASELINE_B08'].includes(params.origemPedido)) return { success: false as const, reasonCode: 'CONTRACT_INVALID' };
  const key = hash([params.tenantId, params.leadId, temporal.utc.toISOString(), motivoNormalizado, policyVersion]);
  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${params.tenantId}:${params.leadId}:followup`}, 0))`;
    const old = await tx.followupOutbound.findFirst({ where: { id: params.followupId, tenantId: params.tenantId, leadId: params.leadId, status: { in: ACTIVE } } });
    if (!old) throw new Error('FOLLOWUP_ACTIVE_NOT_FOUND');
    const evidence = await tx.mensagemProspeccao.findFirst({ where: { leadId: params.leadId, direcao: 'ENTRADA', conteudo: { contains: params.evidenciaPedido.trim(), mode: 'insensitive' } }, select: { id: true } });
    if (!evidence) throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    const existing = await tx.followupOutbound.findUnique({ where: { chaveIdempotencia: key } });
    if (existing) return existing;
    await tx.followupOutbound.update({ where: { id: old.id }, data: { status: 'CANCELADO', reasonCode: 'REAGENDAMENTO', canceladoEm: new Date(), leaseOwner: null, leaseAte: null } });
    return tx.followupOutbound.create({ data: { tenantId: params.tenantId, leadId: params.leadId, agendadoParaUtc: temporal.utc, timezoneIana: temporal.timezone, expressaoOriginal: params.expressaoOriginal, motivo: params.motivo.trim(), motivoNormalizado, policyVersion, chaveIdempotencia: key, origemPedido: params.origemPedido.trim(), evidenciaPedido: params.evidenciaPedido.trim() } });
  }, { isolationLevel: 'Serializable' });
  followupEventos.inc({ resultado: 'reagendado' });
  return { success: true as const, followup: created };
}

export function followupLeaseMs(): number { return Math.max(30_000, Math.min(600_000, Number(process.env.FOLLOWUP_LEASE_MS || 120_000))); }

export async function reivindicarProximoFollowup(owner = FOLLOWUP_OWNER, now = new Date()) {
  const leaseMs = followupLeaseMs();
  const rows = await prisma.$queryRaw<Array<{ id: string; fencingToken: number; agendadoParaUtc: Date; takeover: boolean }>>`
    WITH candidato AS (
      SELECT id, (status = 'REIVINDICADO') AS takeover FROM followups_outbound
      WHERE ((status = 'PENDENTE' AND "agendadoParaUtc" <= ${now})
        OR (status = 'FALHO' AND "proximoRetryEm" IS NOT NULL AND "proximoRetryEm" <= ${now})
        OR (status = 'REIVINDICADO' AND "leaseAte" < ${now}))
      ORDER BY "agendadoParaUtc", "criadoEm" LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE followups_outbound f SET status='REIVINDICADO', "leaseOwner"=${owner},
      "leaseAte"=${new Date(now.getTime() + leaseMs)}, "fencingToken"=f."fencingToken"+1,
      tentativas=f.tentativas+1, "atualizadoEm"=${now}
    FROM candidato WHERE f.id=candidato.id
    RETURNING f.id, f."fencingToken", f."agendadoParaUtc", candidato.takeover
  `;
  const claimed = rows[0];
  if (!claimed) return null;
  followupEventos.inc({ resultado: claimed.takeover ? 'takeover' : 'reivindicado' });
  followupAtraso.observe(Math.max(0, (now.getTime() - claimed.agendadoParaUtc.getTime()) / 1000));
  return prisma.followupOutbound.findUniqueOrThrow({ where: { id: claimed.id }, include: { efeito: true } });
}

export async function renovarLeaseFollowup(id: string, owner: string, fencingToken: number): Promise<boolean> {
  const result = await prisma.followupOutbound.updateMany({ where: { id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken, leaseAte: { gt: new Date() } }, data: { leaseAte: new Date(Date.now() + followupLeaseMs()) } });
  return result.count === 1;
}

async function bloquearAntesEnvio(id: string, owner: string, fencingToken: number, now: Date): Promise<{ reason?: string; effectKey?: string; lead?: any }> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.followupOutbound.findFirst({ where: { id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken, leaseAte: { gt: now } }, include: { lead: { include: { campanhaOrigem: true } }, efeito: true } });
    if (!item) throw new Error('FOLLOWUP_LEASE_LOST');
    let reason: string | undefined;
    if (item.lead.statusProspeccao === 'OPTOUT' || item.lead.statusProspeccao === 'OPT_OUT') reason = 'BLOCKED_OPT_OUT';
    else if (item.lead.modoAtendimento === 'HUMANO') reason = 'BLOCKED_HUMAN_MODE';
    else if (item.lead.modoAtendimento === 'PAUSADO') reason = 'BLOCKED_PAUSED_MODE';
    else if (['SEM_INTERESSE', 'PERDIDO', 'DESCARTADO'].includes(item.lead.statusProspeccao || '')) reason = 'LEAD_INELIGIBLE';
    else if (!item.lead.campanhaOrigem || item.lead.campanhaOrigem.status !== 'ATIVA') reason = 'CAMPAIGN_INACTIVE';
    else if (!item.lead.telefone) reason = 'PHONE_MISSING';
    else if (now.getTime() - item.agendadoParaUtc.getTime() > 24 * 3_600_000) reason = 'FOLLOWUP_EXPIRED';
    else {
      const recent = await tx.mensagemProspeccao.findFirst({ where: { leadId: item.leadId, direcao: 'ENTRADA', dataHora: { gt: item.criadoEm } }, select: { id: true } });
      if (recent) reason = 'RECENT_REPLY';
    }
    if (reason) {
      await tx.followupOutbound.update({ where: { id }, data: { status: reason === 'FOLLOWUP_EXPIRED' ? 'EXPIRADO' : 'CANCELADO', reasonCode: reason, canceladoEm: now, leaseOwner: null, leaseAte: null } });
      return { reason };
    }
    if (item.efeito) {
      await tx.followupOutbound.update({ where: { id }, data: { status: 'FALHO', reasonCode: 'DELIVERY_RECONCILIATION_REQUIRED', leaseOwner: null, leaseAte: null, proximoRetryEm: null } });
      return { reason: 'DELIVERY_RECONCILIATION_REQUIRED' };
    }
    const effectKey = hash(['followup-send', item.id]);
    await tx.efeitoFollowupOutbound.create({ data: { followupId: item.id, fencingToken, chaveIdempotencia: effectKey } });
    return { effectKey, lead: item.lead };
  });
}

export interface FollowupSender { send(instanceName: string, phone: string, message: string, idempotencyKey: string): Promise<{ providerId?: string }> }

export async function processarFollowupReivindicado(item: { id: string; fencingToken: number }, owner: string, sender: FollowupSender, now = new Date()): Promise<'EXECUTADO'|'CANCELADO'|'FALHO'> {
  const gate = await bloquearAntesEnvio(item.id, owner, item.fencingToken, now);
  if (gate.reason) { followupEventos.inc({ resultado: gate.reason.toLowerCase() }); return gate.reason === 'DELIVERY_RECONCILIATION_REQUIRED' ? 'FALHO' : 'CANCELADO'; }
  const session = await prisma.sessaoWhatsapp.findFirst({ where: { tenantId: gate.lead.tenantId, status: 'CONECTADO' }, select: { instanceName: true } });
  if (!session?.instanceName) {
    await prisma.$transaction(async (tx) => {
      await tx.efeitoFollowupOutbound.deleteMany({
        where: { followupId: item.id, fencingToken: item.fencingToken, status: 'RESERVADO' },
      });
      await tx.followupOutbound.updateMany({
        where: { id: item.id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken: item.fencingToken },
        data: { status: 'FALHO', reasonCode: 'SESSION_UNAVAILABLE', proximoRetryEm: new Date(now.getTime() + backoffMs(1)), leaseOwner: null, leaseAte: null },
      });
    });
    followupEventos.inc({ resultado: 'retry' }); return 'FALHO';
  }
  try {
    const sent = await sender.send(session.instanceName, gate.lead.telefone, 'Ola! Conforme combinado, estou retomando nosso contato. Posso ajudar?', gate.effectKey!);
    const confirmed = await prisma.$transaction(async (tx) => {
      const owned = await tx.followupOutbound.findFirst({ where: { id: item.id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken: item.fencingToken, leaseAte: { gt: new Date() } } });
      if (!owned) return false;
      await tx.efeitoFollowupOutbound.update({ where: { followupId: item.id }, data: { status: 'CONCLUIDO', concluidoEm: new Date(), resultado: sent.providerId || 'CONFIRMED' } });
      await tx.mensagemProspeccao.create({ data: { leadId: owned.leadId, direcao: 'SAIDA', conteudo: 'Follow-up outbound confirmado', processadaPorIA: false } });
      await tx.followupOutbound.update({ where: { id: item.id }, data: { status: 'EXECUTADO', executadoEm: new Date(), leaseOwner: null, leaseAte: null, reasonCode: null } });
      return true;
    });
    if (!confirmed) throw new Error('FOLLOWUP_LEASE_LOST_AFTER_SEND');
    followupEventos.inc({ resultado: 'executado' }); return 'EXECUTADO';
  } catch (error) {
    const definitiveNoSend = (error as { definitiveNoSend?: boolean })?.definitiveNoSend === true;
    await prisma.$transaction(async (tx) => {
      if (definitiveNoSend) await tx.efeitoFollowupOutbound.deleteMany({ where: { followupId: item.id, status: 'RESERVADO' } });
      await tx.followupOutbound.updateMany({ where: { id: item.id, leaseOwner: owner, fencingToken: item.fencingToken }, data: { status: 'FALHO', reasonCode: definitiveNoSend ? 'DELIVERY_TRANSIENT' : 'DELIVERY_UNKNOWN', ultimoErro: sanitizeError(error), proximoRetryEm: definitiveNoSend ? new Date(now.getTime() + backoffMs(1)) : null, leaseOwner: null, leaseAte: null } });
    });
    followupEventos.inc({ resultado: definitiveNoSend ? 'retry' : 'falho' }); return 'FALHO';
  }
}

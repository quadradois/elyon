import os from 'os';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { followupAtraso, followupEventos } from '../observabilidade/followup-outbound-metrics';
import { FOLLOWUP_POLICY_VERSION, interpretarFollowupTemporal } from './followup-temporal';
import type { Prisma } from '@prisma/client';

export type FollowupStatus = 'PENDENTE' | 'REIVINDICADO' | 'EXECUTADO' | 'CANCELADO' | 'EXPIRADO' | 'FALHO';
export const FOLLOWUP_OWNER = `${os.hostname()}:${process.pid}`;
const ACTIVE: FollowupStatus[] = ['PENDENTE', 'REIVINDICADO', 'FALHO'];

function equivalenciaAtivaWhere(chaveEquivalencia: string): Prisma.FollowupOutboundWhereInput {
  return { chaveEquivalencia, OR: [
    { status: { in: ['PENDENTE', 'REIVINDICADO'] } },
    { status: 'FALHO', OR: [
      { proximoRetryEm: { not: null } },
      { reasonCode: { in: ['DELIVERY_UNKNOWN', 'DELIVERY_RECONCILIATION_REQUIRED'] } },
    ] },
  ] };
}

function normalizarMotivo(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hash(parts: string[]): string { return createHash('sha256').update(parts.join('|')).digest('hex'); }
export type FollowupRequestIdentity = {
  source: 'INBOUND_BATCH' | 'MANUAL_API' | 'BASELINE';
  id: string;
};
type FollowupRequestOperation = 'CRIAR' | 'REAGENDAR';
type FollowupRequestOutcome = 'CRIADO' | 'REAGENDADO' | 'FOLLOWUP_EQUIVALENTE_ATIVO';
type FollowupLedgerTransaction = Pick<typeof prisma, 'requisicaoFollowupOutbound'>;

function validarIdentidadeConfiavel(origemPedido: string, identity?: FollowupRequestIdentity): identity is FollowupRequestIdentity {
  if (!identity?.id?.trim()) return false;
  return (origemPedido === 'TOOL_AGENDAR_FOLLOWUP' && identity.source === 'INBOUND_BATCH')
    || (origemPedido === 'API_LEADS_FOLLOWUP' && identity.source === 'MANUAL_API')
    || (origemPedido === 'BASELINE_B08' && identity.source === 'BASELINE');
}

function fingerprintRequisicao(params: {
  operacao: 'CRIAR' | 'REAGENDAR'; tenantId: string; leadId: string; followupId?: string;
  utc: Date; motivoNormalizado: string; policyVersion: string; mensagemEnvio: string;
}): string {
  return hash([
    'followup-request-fingerprint-v1', params.operacao, params.tenantId, params.leadId,
    params.followupId || '', params.utc.toISOString(), params.motivoNormalizado,
    params.policyVersion, hash(['followup-message-v1', params.mensagemEnvio]),
  ]);
}

function chaveDaRequisicao(input: CriarFollowupInput): string {
  return hash(['followup-request-v1', input.requestIdentity.source, input.requestIdentity.id.trim()]);
}

async function resolverRequisicaoPersistida(tx: FollowupLedgerTransaction, chaveRequisicao: string, fingerprint: string) {
  const ledger = await tx.requisicaoFollowupOutbound.findUnique({
    where: { chaveRequisicao }, include: { followup: true },
  });
  if (!ledger) return null;
  if (ledger.fingerprint !== fingerprint) return { conflict: true as const };
  await tx.requisicaoFollowupOutbound.update({
    where: { id: ledger.id }, data: { ultimoReplayEm: new Date() },
  });
  return {
    followup: ledger.followup, deduplicado: true,
    reasonCode: 'FOLLOWUP_REQUEST_REPLAY', requestOutcome: ledger.outcome,
  };
}

async function registrarRequisicaoAceita(tx: FollowupLedgerTransaction, params: {
  chaveRequisicao: string; fingerprint: string; operacao: FollowupRequestOperation;
  followupId: string; outcome: FollowupRequestOutcome;
}) {
  await tx.requisicaoFollowupOutbound.create({ data: params });
}
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/^[A-Z][A-Z0-9_:-]{2,80}/)?.[0] || 'FOLLOWUP_PROCESSING_FAILED';
}
export function followupBackoffMs(attempt: number): number { return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1)); }
export function followupMaxTentativas(): number {
  const configured = Number(process.env.FOLLOWUP_MAX_ATTEMPTS || 3);
  return Number.isInteger(configured) ? Math.max(1, Math.min(10, configured)) : 3;
}

export interface CriarFollowupInput {
  tenantId: string; leadId: string; expressaoOriginal: string; timezoneIana: string;
  motivo: string; mensagemEnvio: string; evidenciaPedido: string; origemPedido: string;
  requestIdentity: FollowupRequestIdentity; policyVersion?: string; agora?: Date;
}

export async function criarFollowupOutbound(input: CriarFollowupInput) {
  const policyVersion = input.policyVersion || FOLLOWUP_POLICY_VERSION;
  if (policyVersion !== FOLLOWUP_POLICY_VERSION) return { success: false as const, reasonCode: 'POLICY_VERSION_INVALID' };
  const motivoNormalizado = normalizarMotivo(input.motivo || '');
  if (motivoNormalizado.length < 3) return { success: false as const, reasonCode: 'MOTIVO_REQUIRED' };
  const mensagemEnvio = input.mensagemEnvio?.trim();
  if (!mensagemEnvio) return { success: false as const, reasonCode: 'MENSAGEM_REQUIRED' };
  if (!input.evidenciaPedido?.trim()) return { success: false as const, reasonCode: 'EVIDENCIA_REQUIRED' };
  if (!input.origemPedido?.trim()) return { success: false as const, reasonCode: 'ORIGEM_REQUIRED' };
  if (!['TOOL_AGENDAR_FOLLOWUP', 'API_LEADS_FOLLOWUP', 'BASELINE_B08'].includes(input.origemPedido)) return { success: false as const, reasonCode: 'ORIGEM_INVALID' };
  if (!validarIdentidadeConfiavel(input.origemPedido, input.requestIdentity)) return { success: false as const, reasonCode: 'TRUSTED_REQUEST_ID_REQUIRED' };
  const temporal = interpretarFollowupTemporal({ expressao: input.expressaoOriginal, timezone: input.timezoneIana, agora: input.agora });
  if (!temporal.ok) return { success: false as const, reasonCode: temporal.reasonCode };
  const chaveRequisicao = chaveDaRequisicao(input);
  const requestFingerprint = fingerprintRequisicao({ operacao: 'CRIAR', tenantId: input.tenantId, leadId: input.leadId,
    utc: temporal.utc, motivoNormalizado, policyVersion, mensagemEnvio });
  const chaveEquivalencia = hash([input.tenantId, input.leadId, temporal.utc.toISOString(), motivoNormalizado, policyVersion]);

  let result: { followup: any; deduplicado: boolean; reasonCode?: string; requestOutcome?: string } | { conflict: true } | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.tenantId}:${input.leadId}:followup`}, 0))`;
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, tenantId: input.tenantId }, select: { id: true } });
    if (!lead) throw new Error('TENANT_OWNERSHIP_DENIED');
    if (input.origemPedido === 'API_LEADS_FOLLOWUP') {
      if (input.evidenciaPedido !== 'OPERADOR_AUTENTICADO_CHAT_PANEL') throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    } else {
      const evidence = await tx.mensagemProspeccao.findFirst({ where: { leadId: input.leadId, direcao: 'ENTRADA', conteudo: { contains: input.evidenciaPedido.trim(), mode: 'insensitive' } }, select: { id: true } });
      if (!evidence) throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    }
    const replay = await resolverRequisicaoPersistida(tx, chaveRequisicao, requestFingerprint);
    if (replay) return replay;
    const existing = await tx.followupOutbound.findFirst({ where: equivalenciaAtivaWhere(chaveEquivalencia) });
    if (existing) {
      await registrarRequisicaoAceita(tx, { chaveRequisicao, fingerprint: requestFingerprint,
        operacao: 'CRIAR', followupId: existing.id, outcome: 'FOLLOWUP_EQUIVALENTE_ATIVO' });
      return { followup: existing, deduplicado: true, reasonCode: 'FOLLOWUP_EQUIVALENTE_ATIVO', requestOutcome: 'FOLLOWUP_EQUIVALENTE_ATIVO' };
    }
    const followup = await tx.followupOutbound.create({ data: {
      tenantId: input.tenantId, leadId: input.leadId, agendadoParaUtc: temporal.utc,
      timezoneIana: temporal.timezone, expressaoOriginal: input.expressaoOriginal,
      motivo: input.motivo.trim(), motivoNormalizado, mensagemEnvio, policyVersion, chaveEquivalencia,
      origemPedido: input.origemPedido.trim(), evidenciaPedido: input.evidenciaPedido.trim(),
    } });
    await registrarRequisicaoAceita(tx, { chaveRequisicao, fingerprint: requestFingerprint,
      operacao: 'CRIAR', followupId: followup.id, outcome: 'CRIADO' });
    await tx.lead.update({ where: { id: input.leadId }, data: { dataRecontato: temporal.utc, motivoRecontato: input.motivo.trim() } });
    return { followup, deduplicado: false, reasonCode: undefined, requestOutcome: 'CRIADO' };
      }, { isolationLevel: 'Serializable' });
      break;
    } catch (error) {
      if (!['P2002', 'P2034'].includes((error as { code?: string }).code || '') || attempt === 3) throw error;
    }
  }
  if (!result) throw new Error('FOLLOWUP_CREATE_RETRY_EXHAUSTED');
  if ('conflict' in result) return { success: false as const, reasonCode: 'REQUEST_ID_CONFLICT' };
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
  const mensagemEnvio = params.mensagemEnvio?.trim();
  if (!motivoNormalizado || !mensagemEnvio || !params.evidenciaPedido?.trim() || !params.origemPedido?.trim()) return { success: false as const, reasonCode: 'CONTRACT_INVALID' };
  const policyVersion = params.policyVersion || FOLLOWUP_POLICY_VERSION;
  if (policyVersion !== FOLLOWUP_POLICY_VERSION || !['TOOL_AGENDAR_FOLLOWUP', 'API_LEADS_FOLLOWUP', 'BASELINE_B08'].includes(params.origemPedido)) return { success: false as const, reasonCode: 'CONTRACT_INVALID' };
  if (!validarIdentidadeConfiavel(params.origemPedido, params.requestIdentity)) return { success: false as const, reasonCode: 'TRUSTED_REQUEST_ID_REQUIRED' };
  const chaveRequisicao = chaveDaRequisicao(params);
  const requestFingerprint = fingerprintRequisicao({ operacao: 'REAGENDAR', tenantId: params.tenantId, leadId: params.leadId,
    followupId: params.followupId, utc: temporal.utc, motivoNormalizado, policyVersion, mensagemEnvio });
  const chaveEquivalencia = hash([params.tenantId, params.leadId, temporal.utc.toISOString(), motivoNormalizado, policyVersion]);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${params.tenantId}:${params.leadId}:followup`}, 0))`;
    const replay = await resolverRequisicaoPersistida(tx, chaveRequisicao, requestFingerprint);
    if (replay) return 'conflict' in replay ? { blocked: 'REQUEST_ID_CONFLICT' as const } : replay;
    const old = await tx.followupOutbound.findFirst({ where: { id: params.followupId, tenantId: params.tenantId, leadId: params.leadId, status: { in: ACTIVE } }, include: { efeito: true } });
    if (!old) throw new Error('FOLLOWUP_ACTIVE_NOT_FOUND');
    if (old.reasonCode === 'DELIVERY_UNKNOWN') return { blocked: 'FOLLOWUP_DELIVERY_UNKNOWN' as const };
    if (old.reasonCode === 'DELIVERY_RECONCILIATION_REQUIRED') return { blocked: 'FOLLOWUP_RECONCILIATION_REQUIRED' as const };
    if (old.efeito?.status === 'RESERVADO') return { blocked: 'FOLLOWUP_EFFECT_RESERVED' as const };
    if (params.origemPedido === 'API_LEADS_FOLLOWUP') {
      if (params.evidenciaPedido !== 'OPERADOR_AUTENTICADO_CHAT_PANEL') throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    } else {
      const evidence = await tx.mensagemProspeccao.findFirst({ where: { leadId: params.leadId, direcao: 'ENTRADA', conteudo: { contains: params.evidenciaPedido.trim(), mode: 'insensitive' } }, select: { id: true } });
      if (!evidence) throw new Error('EVIDENCIA_NAO_CONFIRMADA');
    }
    const existing = await tx.followupOutbound.findFirst({ where: { ...equivalenciaAtivaWhere(chaveEquivalencia), id: { not: old.id } } });
    if (existing) return { blocked: 'FOLLOWUP_EQUIVALENTE_EXISTENTE' as const };
    await tx.followupOutbound.update({ where: { id: old.id }, data: { status: 'CANCELADO', reasonCode: 'REAGENDAMENTO', canceladoEm: new Date(), leaseOwner: null, leaseAte: null } });
    const followup = await tx.followupOutbound.create({ data: { tenantId: params.tenantId, leadId: params.leadId, agendadoParaUtc: temporal.utc, timezoneIana: temporal.timezone, expressaoOriginal: params.expressaoOriginal, motivo: params.motivo.trim(), motivoNormalizado, mensagemEnvio, policyVersion, chaveEquivalencia, origemPedido: params.origemPedido.trim(), evidenciaPedido: params.evidenciaPedido.trim() } });
    await registrarRequisicaoAceita(tx, { chaveRequisicao, fingerprint: requestFingerprint,
      operacao: 'REAGENDAR', followupId: followup.id, outcome: 'REAGENDADO' });
    return { followup, deduplicado: false, reasonCode: undefined, requestOutcome: 'REAGENDADO' };
  }, { isolationLevel: 'Serializable' });
  if ('blocked' in result) return { success: false as const, reasonCode: result.blocked };
  followupEventos.inc({ resultado: 'reagendado' });
  return { success: true as const, followup: result.followup, deduplicado: result.deduplicado, reasonCode: result.reasonCode };
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

async function bloquearAntesEnvio(id: string, owner: string, fencingToken: number, now: Date): Promise<{ reason?: string; effectKey?: string; lead?: any; tentativas?: number; mensagemEnvio?: string }> {
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
    return { effectKey, lead: item.lead, tentativas: item.tentativas, mensagemEnvio: item.mensagemEnvio };
  });
}

export interface FollowupSender { send(instanceName: string, phone: string, message: string, idempotencyKey: string): Promise<{ providerId?: string }> }

function retryData(attempt: number, now: Date, transientReason: string) {
  if (attempt >= followupMaxTentativas()) {
    return { status: 'FALHO' as const, reasonCode: 'RETRY_EXHAUSTED', proximoRetryEm: null };
  }
  return { status: 'FALHO' as const, reasonCode: transientReason, proximoRetryEm: new Date(now.getTime() + followupBackoffMs(attempt)) };
}

export async function processarFollowupReivindicado(item: { id: string; fencingToken: number }, owner: string, sender: FollowupSender, now = new Date()): Promise<'EXECUTADO'|'CANCELADO'|'FALHO'> {
  const gate = await bloquearAntesEnvio(item.id, owner, item.fencingToken, now);
  if (gate.reason) { followupEventos.inc({ resultado: gate.reason.toLowerCase() }); return gate.reason === 'DELIVERY_RECONCILIATION_REQUIRED' ? 'FALHO' : 'CANCELADO'; }
  const session = await prisma.sessaoWhatsapp.findFirst({ where: { tenantId: gate.lead.tenantId, status: 'CONECTADO' }, select: { instanceName: true } });
  if (!session?.instanceName) {
    const retry = retryData(gate.tentativas!, now, 'SESSION_UNAVAILABLE');
    await prisma.$transaction(async (tx) => {
      await tx.efeitoFollowupOutbound.deleteMany({
        where: { followupId: item.id, fencingToken: item.fencingToken, status: 'RESERVADO' },
      });
      await tx.followupOutbound.updateMany({
        where: { id: item.id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken: item.fencingToken },
        data: { ...retry, leaseOwner: null, leaseAte: null },
      });
    });
    followupEventos.inc({ resultado: retry.reasonCode === 'RETRY_EXHAUSTED' ? 'retry_exhausted' : 'retry' }); return 'FALHO';
  }
  try {
    const sent = await sender.send(session.instanceName, gate.lead.telefone, gate.mensagemEnvio!, gate.effectKey!);
    const confirmed = await prisma.$transaction(async (tx) => {
      const confirmationTime = new Date();
      const acquired = await tx.followupOutbound.updateMany({
        where: { id: item.id, status: 'REIVINDICADO', leaseOwner: owner, fencingToken: item.fencingToken, leaseAte: { gt: confirmationTime } },
        data: { status: 'EXECUTADO', executadoEm: confirmationTime, leaseOwner: null, leaseAte: null, reasonCode: null },
      });
      if (acquired.count !== 1) return false;
      const effect = await tx.efeitoFollowupOutbound.updateMany({
        where: { followupId: item.id, status: 'RESERVADO', fencingToken: item.fencingToken },
        data: { status: 'CONCLUIDO', concluidoEm: confirmationTime, resultado: sent.providerId || 'CONFIRMED' },
      });
      if (effect.count !== 1) throw new Error('FOLLOWUP_EFFECT_FENCE_MISMATCH');
      const owned = await tx.followupOutbound.findUniqueOrThrow({ where: { id: item.id }, select: { leadId: true, mensagemEnvio: true } });
      await tx.mensagemProspeccao.create({ data: { leadId: owned.leadId, direcao: 'SAIDA', conteudo: owned.mensagemEnvio, processadaPorIA: false } });
      return true;
    });
    if (!confirmed) throw new Error('FOLLOWUP_LEASE_LOST_AFTER_SEND');
    followupEventos.inc({ resultado: 'executado' }); return 'EXECUTADO';
  } catch (error) {
    const definitiveNoSend = (error as { definitiveNoSend?: boolean })?.definitiveNoSend === true;
    const retry = definitiveNoSend ? retryData(gate.tentativas!, now, 'DELIVERY_TRANSIENT') : { status: 'FALHO' as const, reasonCode: 'DELIVERY_UNKNOWN', proximoRetryEm: null };
    await prisma.$transaction(async (tx) => {
      if (definitiveNoSend) await tx.efeitoFollowupOutbound.deleteMany({ where: { followupId: item.id, fencingToken: item.fencingToken, status: 'RESERVADO' } });
      await tx.followupOutbound.updateMany({ where: { id: item.id, leaseOwner: owner, fencingToken: item.fencingToken }, data: { ...retry, ultimoErro: sanitizeError(error), leaseOwner: null, leaseAte: null } });
    });
    followupEventos.inc({ resultado: retry.reasonCode === 'RETRY_EXHAUSTED' ? 'retry_exhausted' : definitiveNoSend ? 'retry' : 'falho' }); return 'FALHO';
  }
}

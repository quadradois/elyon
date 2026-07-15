import os from 'os';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { lotesInboundAbertos, lotesInboundEventos } from './consolidacao-mensagens-inbound-metrics';

export type StatusLoteInbound = 'ABERTO' | 'PROCESSANDO' | 'CONCLUIDO' | 'FALHO' | 'CANCELADO';

export interface FragmentoInbound {
  id: string;
  webhookEventoId: string;
  messageId: string | null;
  conteudo: string;
  tipo: string;
  metadata: unknown;
  recebidoEm: Date;
}

export interface LoteInboundReivindicado {
  id: string;
  tenantId: string;
  leadId: string;
  status: StatusLoteInbound;
  fechaEm: Date;
  tentativas: number;
  fencingToken: number;
  fragmentos: FragmentoInbound[];
}

export const LOTE_INBOUND_OWNER = `${os.hostname()}:${process.pid}`;

export function duracaoLeaseLoteInboundMs(): number {
  const segundos = Number(process.env.WEBHOOK_WORKER_LEASE_SECONDS || 300);
  return Math.max(30_000, Math.min(3_600_000, segundos * 1_000));
}

function erroSanitizado(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const reasonCode = message.match(/^[A-Z][A-Z0-9_:-]{2,80}/)?.[0];
  return reasonCode || 'PROCESSING_FAILED';
}

async function atualizarGauge(): Promise<void> {
  const count = await prisma.loteMensagemInbound.count({ where: { status: { in: ['ABERTO', 'FALHO'] } } });
  lotesInboundAbertos.set(count);
}

export async function registrarFragmentoInbound(params: {
  tenantId: string;
  leadId: string;
  webhookEventoId: string;
  messageId?: string;
  conteudo: string;
  tipo: string;
  metadata?: Record<string, string | undefined>;
  recebidoEm: Date;
  janelaMs: number;
}): Promise<{ loteId: string; duplicado: boolean }> {
  let result: { loteId: string; duplicado: boolean; aberto: boolean } | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: params.leadId, tenantId: params.tenantId }, select: { id: true } });
    if (!lead) throw new Error('TENANT_MISMATCH: Lead nao pertence ao tenant confiavel');

    const existente = await tx.fragmentoMensagemInbound.findUnique({
      where: { webhookEventoId: params.webhookEventoId },
      include: { lote: { select: { id: true, tenantId: true, leadId: true } } },
    });
    if (existente) {
      if (existente.lote.tenantId !== params.tenantId || existente.lote.leadId !== params.leadId) {
        throw new Error('TENANT_MISMATCH: replay pertence a outro agrupamento');
      }
      return { loteId: existente.loteId, duplicado: true, aberto: false };
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${params.tenantId}:${params.leadId}`}, 0))`;
    const agora = new Date();
    let lote = await tx.loteMensagemInbound.findFirst({
      where: { tenantId: params.tenantId, leadId: params.leadId, status: 'ABERTO', fechaEm: { gt: agora } },
      orderBy: { criadoEm: 'desc' },
    });
    if (!lote) {
      lote = await tx.loteMensagemInbound.create({
        data: { tenantId: params.tenantId, leadId: params.leadId, fechaEm: new Date(agora.getTime() + params.janelaMs) },
      });
    } else {
      lote = await tx.loteMensagemInbound.update({
        where: { id: lote.id },
        data: { fechaEm: new Date(agora.getTime() + params.janelaMs) },
      });
    }
    await tx.fragmentoMensagemInbound.create({
      data: {
        loteId: lote.id,
        webhookEventoId: params.webhookEventoId,
        messageId: params.messageId,
        conteudo: params.conteudo,
        tipo: params.tipo,
        metadata: params.metadata,
        recebidoEm: params.recebidoEm,
      },
    });
        return { loteId: lote.id, duplicado: false, aberto: lote.criadoEm.getTime() === lote.atualizadoEm.getTime() };
      }, { isolationLevel: 'Serializable' });
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt === 3) throw error;
    }
  }
  if (!result) throw new Error('Nao foi possivel registrar fragmento inbound');
  if (result.aberto) lotesInboundEventos.inc({ resultado: 'aberto' });
  await atualizarGauge();
  return { loteId: result.loteId, duplicado: result.duplicado };
}

export async function reivindicarLoteInbound(
  loteId: string,
  tenantId: string,
  leadId: string,
  owner = LOTE_INBOUND_OWNER,
  leaseMs = duracaoLeaseLoteInboundMs(),
): Promise<LoteInboundReivindicado | null> {
  const [claimed] = await prisma.$queryRaw<Array<{ id: string; statusAnterior: string; tentativas: number; fechaEm: Date; fencingToken: number }>>`
    WITH candidato AS (
      SELECT id, status AS "statusAnterior"
      FROM lotes_mensagens_inbound
      WHERE id = ${loteId} AND "tenantId" = ${tenantId} AND "leadId" = ${leadId}
        AND ((status IN ('ABERTO', 'FALHO') AND "fechaEm" <= CURRENT_TIMESTAMP)
          OR (status = 'PROCESSANDO' AND "leaseAte" < CURRENT_TIMESTAMP))
      FOR UPDATE SKIP LOCKED
    )
    UPDATE lotes_mensagens_inbound lote
    SET status = 'PROCESSANDO', "leaseOwner" = ${owner},
        "leaseAte" = CURRENT_TIMESTAMP + (${leaseMs}::int * INTERVAL '1 millisecond'),
        tentativas = lote.tentativas + 1, "fencingToken" = lote."fencingToken" + 1,
        "atualizadoEm" = CURRENT_TIMESTAMP
    FROM candidato
    WHERE lote.id = candidato.id
    RETURNING lote.id, candidato."statusAnterior", lote.tentativas, lote."fechaEm", lote."fencingToken"
  `;
  if (!claimed) return null;
  if (claimed.statusAnterior === 'PROCESSANDO') lotesInboundEventos.inc({ resultado: 'expirado' });
  if (claimed.statusAnterior === 'FALHO') lotesInboundEventos.inc({ resultado: 'reprocessado' });
  const fragmentos = await prisma.fragmentoMensagemInbound.findMany({
    where: { loteId }, orderBy: [{ recebidoEm: 'asc' }, { id: 'asc' }],
    select: { id: true, webhookEventoId: true, messageId: true, conteudo: true, tipo: true, metadata: true, recebidoEm: true },
  });
  return { id: loteId, tenantId, leadId, status: 'PROCESSANDO', fechaEm: claimed.fechaEm, tentativas: claimed.tentativas, fencingToken: claimed.fencingToken, fragmentos };
}

export async function reivindicarProximoLoteInbound(
  owner = LOTE_INBOUND_OWNER,
  leaseMs = duracaoLeaseLoteInboundMs(),
): Promise<LoteInboundReivindicado | null> {
  const candidato = await prisma.$queryRaw<Array<{ id: string; tenantId: string; leadId: string }>>`
    SELECT id, "tenantId", "leadId"
    FROM lotes_mensagens_inbound
    WHERE ((status IN ('ABERTO', 'FALHO') AND "fechaEm" <= CURRENT_TIMESTAMP)
      OR (status = 'PROCESSANDO' AND "leaseAte" < CURRENT_TIMESTAMP))
    ORDER BY "fechaEm" ASC, "criadoEm" ASC
    LIMIT 1
  `;
  const lote = candidato[0];
  return lote ? reivindicarLoteInbound(lote.id, lote.tenantId, lote.leadId, owner, leaseMs) : null;
}

export async function renovarLeaseLoteInbound(
  loteId: string,
  owner = LOTE_INBOUND_OWNER,
  leaseMs = duracaoLeaseLoteInboundMs(),
  fencingToken?: number,
): Promise<boolean> {
  const updated = await prisma.loteMensagemInbound.updateMany({
    where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, ...(fencingToken === undefined ? {} : { fencingToken }) },
    data: { leaseAte: new Date(Date.now() + leaseMs) },
  });
  return updated.count === 1;
}

export async function validarFencingLoteInbound(loteId: string, owner: string, fencingToken: number): Promise<void> {
  const lote = await prisma.loteMensagemInbound.findFirst({
    where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, fencingToken, leaseAte: { gt: new Date() } },
    select: { id: true },
  });
  if (!lote) throw new Error('LOTE_LEASE_PERDIDO');
}

export async function obterLoteReivindicado(loteId: string, owner: string, fencingToken: number): Promise<LoteInboundReivindicado> {
  await validarFencingLoteInbound(loteId, owner, fencingToken);
  const lote = await prisma.loteMensagemInbound.findUniqueOrThrow({
    where: { id: loteId },
    include: { fragmentos: { orderBy: [{ recebidoEm: 'asc' }, { id: 'asc' }] } },
  });
  return {
    id: lote.id,
    tenantId: lote.tenantId,
    leadId: lote.leadId,
    status: 'PROCESSANDO',
    fechaEm: lote.fechaEm,
    tentativas: lote.tentativas,
    fencingToken: lote.fencingToken,
    fragmentos: lote.fragmentos,
  } as LoteInboundReivindicado;
}

export type EstadoIntencaoEfeito = 'NOVA' | 'RESERVADA' | 'CONCLUIDA';
export interface IntencaoEfeitoInbound { estado: EstadoIntencaoEfeito; chaveIdempotencia: string }

export async function reservarEfeitoLoteInbound(
  loteId: string, owner: string, fencingToken: number, tipo: string,
): Promise<IntencaoEfeitoInbound> {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.loteMensagemInbound.findFirst({
      where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, fencingToken, leaseAte: { gt: new Date() } },
      select: { id: true },
    });
    if (!lote) throw new Error('LOTE_LEASE_PERDIDO');
    const existente = await tx.efeitoLoteInbound.findUnique({ where: { loteId_tipo: { loteId, tipo } } });
    if (existente?.status === 'CONCLUIDO') {
      return { estado: 'CONCLUIDA', chaveIdempotencia: existente.chaveIdempotencia };
    }
    if (existente) {
      // Reconciliação: um novo owner assume a intenção abandonada, preservando
      // a mesma chave para que o adapter/provedor deduplique um envio incerto.
      await tx.efeitoLoteInbound.update({
        where: { id: existente.id }, data: { fencingToken, status: 'RESERVADO' },
      });
      return { estado: 'RESERVADA', chaveIdempotencia: existente.chaveIdempotencia };
    }
    const chaveIdempotencia = createHash('sha256').update(`elyon:${loteId}:${tipo}`).digest('hex');
    await tx.efeitoLoteInbound.create({ data: { loteId, tipo, fencingToken, chaveIdempotencia } });
    return { estado: 'NOVA', chaveIdempotencia };
  }, { isolationLevel: 'Serializable' });
}

export async function concluirEfeitoLoteInbound(
  loteId: string, fencingToken: number, tipo: string,
): Promise<boolean> {
  const result = await prisma.efeitoLoteInbound.updateMany({
    where: { loteId, tipo, fencingToken, status: 'RESERVADO' },
    data: { status: 'CONCLUIDO', concluidoEm: new Date() },
  });
  return result.count === 1;
}

export async function liberarEfeitoLoteInbound(loteId: string, fencingToken: number, tipo: string): Promise<void> {
  await prisma.efeitoLoteInbound.deleteMany({ where: { loteId, tipo, fencingToken, status: 'RESERVADO' } });
}

export async function obterEstadoLoteInbound(loteId: string): Promise<{ status: StatusLoteInbound; fechaEm: Date; leaseAte: Date | null } | null> {
  return prisma.loteMensagemInbound.findUnique({ where: { id: loteId }, select: { status: true, fechaEm: true, leaseAte: true } }) as Promise<{ status: StatusLoteInbound; fechaEm: Date; leaseAte: Date | null } | null>;
}

export async function concluirLoteInbound(loteId: string, owner = LOTE_INBOUND_OWNER, fencingToken?: number): Promise<boolean> {
  const updated = await prisma.loteMensagemInbound.updateMany({
    where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, ...(fencingToken === undefined ? {} : { fencingToken }) },
    data: { status: 'CONCLUIDO', processadoEm: new Date(), leaseOwner: null, leaseAte: null, ultimoErro: null },
  });
  if (updated.count) lotesInboundEventos.inc({ resultado: 'consolidado' });
  await atualizarGauge();
  return updated.count === 1;
}

export async function falharLoteInbound(loteId: string, error: unknown, owner = LOTE_INBOUND_OWNER, fencingToken?: number): Promise<boolean> {
  const updated = await prisma.loteMensagemInbound.updateMany({
    where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, ...(fencingToken === undefined ? {} : { fencingToken }) },
    data: { status: 'FALHO', fechaEm: new Date(), leaseOwner: null, leaseAte: null, ultimoErro: erroSanitizado(error) },
  });
  if (updated.count) lotesInboundEventos.inc({ resultado: 'falho' });
  await atualizarGauge();
  return updated.count === 1;
}

export async function cancelarLoteInbound(loteId: string, reasonCode: string, owner = LOTE_INBOUND_OWNER, fencingToken?: number): Promise<boolean> {
  const updated = await prisma.loteMensagemInbound.updateMany({
    where: { id: loteId, status: 'PROCESSANDO', leaseOwner: owner, ...(fencingToken === undefined ? {} : { fencingToken }) },
    data: { status: 'CANCELADO', processadoEm: new Date(), leaseOwner: null, leaseAte: null, ultimoErro: reasonCode },
  });
  if (updated.count) lotesInboundEventos.inc({ resultado: 'cancelado' });
  await atualizarGauge();
  return updated.count === 1;
}

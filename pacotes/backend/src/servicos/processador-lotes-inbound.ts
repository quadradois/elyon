import type { Request, Response } from 'express';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import {
  cancelarLoteInbound,
  falharLoteInbound,
  LOTE_INBOUND_OWNER,
  reivindicarProximoLoteInbound,
  type LoteInboundReivindicado,
} from './consolidacao-mensagens-inbound';

function criarRequest(payload: Record<string, unknown>, lote: LoteInboundReivindicado, owner: string): Request {
  const headers: Record<string, string> = {
    'x-elyon-batch-id': lote.id,
    'x-elyon-batch-owner': owner,
    'x-elyon-batch-fencing-token': String(lote.fencingToken),
  };
  return {
    body: payload,
    query: {},
    rawBody: Buffer.from(JSON.stringify(payload)),
    headers,
    get(nome: string) { return headers[nome.toLowerCase()]; },
  } as unknown as Request;
}

function criarResponse(): { res: Response; status: { code: number } } {
  const status = { code: 200 };
  const res = {
    status(code: number) { status.code = code; return res; }, json() { return res; }, send() { return res; },
    sendStatus(code: number) { status.code = code; return res; }, end() { return res; },
  };
  return { res: res as unknown as Response, status };
}

export async function processarLoteInboundReivindicado(lote: LoteInboundReivindicado, owner = LOTE_INBOUND_OWNER): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: lote.leadId, tenantId: lote.tenantId },
    select: { modoAtendimento: true, statusProspeccao: true, telefone: true },
  });
  if (!lead) throw new Error('TENANT_MISMATCH: Lead ausente no processamento do lote');
  const motivoBloqueio = lead.statusProspeccao === 'OPTOUT' || lead.statusProspeccao === 'OPT_OUT'
    ? 'OPT_OUT_BLOCKS_AI'
    : lead.modoAtendimento === 'HUMANO' || lead.modoAtendimento === 'PAUSADO'
      ? 'HUMAN_MODE_BLOCKS_AI' : undefined;
  if (motivoBloqueio) {
    await prisma.mensagemProspeccao.createMany({
      data: lote.fragmentos.map((fragmento) => ({
        leadId: lote.leadId,
        direcao: 'ENTRADA',
        conteudo: fragmento.conteudo,
        tipo: fragmento.tipo,
        telefone: lead.telefone,
        messageId: fragmento.messageId,
      })),
    });
    await cancelarLoteInbound(lote.id, motivoBloqueio, owner, lote.fencingToken);
    return;
  }
  const origem = lote.fragmentos[0];
  if (!origem) throw new Error('LOTE_SEM_FRAGMENTOS');
  const evento = await prisma.webhookEvento.findUnique({ where: { id: origem.webhookEventoId }, select: { payload: true } });
  if (!evento?.payload || typeof evento.payload !== 'object' || Array.isArray(evento.payload)) {
    throw new Error('LOTE_PAYLOAD_ORIGEM_AUSENTE');
  }
  const { processarWebhookEvolution } = await import('../rotas/webhook');
  const response = criarResponse();
  await processarWebhookEvolution(
    criarRequest(evento.payload as Record<string, unknown>, lote, owner),
    response.res,
  );
  if (response.status.code >= 400) throw new Error(`LOTE_HANDLER_HTTP_${response.status.code}`);
}

export async function executarProximoLoteInbound(owner = LOTE_INBOUND_OWNER): Promise<boolean> {
  const lote = await reivindicarProximoLoteInbound(owner);
  if (!lote) return false;
  try {
    await processarLoteInboundReivindicado(lote, owner);
  } catch (erro) {
    await falharLoteInbound(lote.id, erro, owner, lote.fencingToken);
    logger.error({ err: erro, loteId: lote.id, fencingToken: lote.fencingToken }, '[WORKER] Falha no lote inbound');
  }
  return true;
}

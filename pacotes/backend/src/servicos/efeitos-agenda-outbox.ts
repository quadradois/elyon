import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { agendaEfeitosEventos } from '../observabilidade/agenda-comercial-metrics';
import { getWhatsAppService } from './whatsapp';

const LEASE_MS = 120_000;
export const AGENDA_EFFECT_OWNER = `agenda-effect:${process.pid}:${randomUUID()}`;

export interface AgendaEffectSender {
  send(instanceName: string, phone: string, message: string, idempotencyKey: string): Promise<{ providerId?: string }>;
}

export async function reivindicarProximoEfeitoAgenda(owner = AGENDA_EFFECT_OWNER, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.efeitoAgendaOutbox.updateMany({
      where: { status: 'RESERVADA', leaseAte: { lte: now } },
      data: { status: 'RECONCILIACAO', reasonCode: 'DELIVERY_UNKNOWN', reconciliacaoEm: now, leaseOwner: null, leaseAte: null },
    });
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "efeitos_agenda_outbox"
      WHERE "status" = 'NOVA'
      ORDER BY "criadoEm" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    `;
    if (!candidates[0]) return null;
    return tx.efeitoAgendaOutbox.update({
      where: { id: candidates[0].id },
      data: {
        status: 'RESERVADA', leaseOwner: owner, leaseAte: new Date(now.getTime() + LEASE_MS),
        fencingToken: { increment: 1 }, tentativas: { increment: 1 },
      },
    });
  });
}

const defaultSender: AgendaEffectSender = {
  async send(instanceName, phone, message, idempotencyKey) {
    const result = await getWhatsAppService(instanceName).enviarMensagemTexto(phone, message, idempotencyKey);
    return { providerId: result?.key?.id || result?.id };
  },
};

export async function executarProximoEfeitoAgenda(
  owner = AGENDA_EFFECT_OWNER,
  sender: AgendaEffectSender = defaultSender,
  now = new Date(),
): Promise<boolean> {
  const effect = await reivindicarProximoEfeitoAgenda(owner, now);
  if (!effect) return false;
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: effect.leadId, tenantId: effect.tenantId },
      select: { telefone: true },
    });
    const session = await prisma.sessaoWhatsapp.findFirst({
      where: { tenantId: effect.tenantId, status: 'CONECTADO' },
      select: { instanceName: true },
    });
    if (!lead?.telefone || !session?.instanceName) throw new Error('AGENDA_EFFECT_DESTINATION_UNAVAILABLE');
    const sent = await sender.send(session.instanceName, lead.telefone, effect.mensagem, effect.chaveIdempotencia);
    const confirmationTime = new Date();
    const confirmed = await prisma.efeitoAgendaOutbox.updateMany({
      where: {
        id: effect.id, status: 'RESERVADA', leaseOwner: owner, fencingToken: effect.fencingToken,
        leaseAte: { gt: confirmationTime },
      },
      data: {
        status: 'CONCLUIDA', concluidoEm: confirmationTime, leaseOwner: null, leaseAte: null,
        resultado: sent.providerId || 'CONFIRMED', reasonCode: null,
      },
    });
    if (confirmed.count !== 1) throw new Error('AGENDA_EFFECT_CONFIRMATION_FENCE_LOST');
    agendaEfeitosEventos.inc({ resultado: 'concluida' });
  } catch (error) {
    await prisma.efeitoAgendaOutbox.updateMany({
      where: { id: effect.id, status: 'RESERVADA', leaseOwner: owner, fencingToken: effect.fencingToken },
      data: {
        status: 'RECONCILIACAO', reasonCode: 'DELIVERY_UNKNOWN', reconciliacaoEm: new Date(),
        leaseOwner: null, leaseAte: null,
      },
    });
    agendaEfeitosEventos.inc({ resultado: 'reconciliacao' });
    logger.error({ effectType: effect.tipo, reasonCode: 'DELIVERY_UNKNOWN' }, '[AGENDA_EFFECT] Resultado requer reconciliacao');
  }
  return true;
}

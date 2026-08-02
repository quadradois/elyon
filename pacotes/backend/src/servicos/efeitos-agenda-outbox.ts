import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { agendaEfeitosEventos } from '../observabilidade/agenda-comercial-metrics';
import type { AgendaPilotScope } from './agenda-pilot-config';
import { getWhatsAppService } from './whatsapp';

const LEASE_MS = 120_000;
export const AGENDA_EFFECT_OWNER = `agenda-effect:${process.pid}:${randomUUID()}`;

export function montarMensagemAgendaPorFato(params: {
  fato: 'SOLICITADA' | 'PENDENTE_ESPECIALISTA' | 'CONFIRMADA';
  modalidade: 'TELEFONE' | 'VISITA';
  dataHora: string;
  especialistaNome?: string | null;
}): string {
  const especialista = params.especialistaNome?.trim() || 'um especialista';
  if (params.fato === 'SOLICITADA') {
    return `Sua solicitação para ${params.dataHora} foi registrada. Assim que ${especialista} confirmar, avisaremos por aqui.`;
  }
  if (params.fato === 'PENDENTE_ESPECIALISTA') {
    return `Recebemos sua solicitação para ${params.dataHora}, mas ainda estamos definindo o especialista. O atendimento ainda não está confirmado.`;
  }
  return params.modalidade === 'TELEFONE'
    ? `Ligação confirmada para ${params.dataHora}. ${especialista} ligará no horário combinado.`
    : `Visita confirmada para ${params.dataHora} com ${especialista}.`;
}

export interface AgendaEffectSender {
  send(instanceName: string, phone: string, message: string, idempotencyKey: string): Promise<{ providerId?: string }>;
}

export async function reivindicarProximoEfeitoAgenda(
  scope: AgendaPilotScope | undefined,
  owner = AGENDA_EFFECT_OWNER,
  now = new Date(),
) {
  if (!scope) return null;
  const startedAt = new Date(scope.startedAtUtc);
  if (!Number.isFinite(startedAt.getTime())) return null;
  return prisma.$transaction(async (tx) => {
    const activeTenant = await tx.tenant.findFirst({
      where: { id: scope.tenantId, status: 'ATIVO' }, select: { id: true },
    });
    if (!activeTenant) return null;
    await tx.efeitoAgendaOutbox.updateMany({
      where: { tenantId: scope.tenantId, status: 'NOVA', criadoEm: { lt: startedAt } },
      data: { status: 'RECONCILIACAO', reasonCode: 'PILOT_PRE_CUTOFF', reconciliacaoEm: now },
    });
    await tx.efeitoAgendaOutbox.updateMany({
      where: { tenantId: scope.tenantId, status: 'RESERVADA', leaseAte: { lte: now } },
      data: { status: 'RECONCILIACAO', reasonCode: 'DELIVERY_UNKNOWN', reconciliacaoEm: now, leaseOwner: null, leaseAte: null },
    });
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT e."id" FROM "efeitos_agenda_outbox" e
      JOIN "tenants" t ON t."id" = e."tenantId" AND t."status" = 'ATIVO'
      WHERE e."status" = 'NOVA'
        AND e."tenantId" = ${scope.tenantId}
        AND e."criadoEm" >= ${startedAt}
      ORDER BY e."criadoEm" ASC, e."id" ASC
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
  scope: AgendaPilotScope | undefined,
  owner = AGENDA_EFFECT_OWNER,
  sender: AgendaEffectSender = defaultSender,
  now = new Date(),
): Promise<boolean> {
  const effect = await reivindicarProximoEfeitoAgenda(scope, owner, now);
  if (!effect) return false;
  try {
    const destination = effect.destinatarioTipo === 'USUARIO' && effect.usuarioDestinoId
      ? await prisma.usuario.findFirst({
          where: { id: effect.usuarioDestinoId, tenantId: effect.tenantId }, select: { telefone: true },
        })
      : await prisma.lead.findFirst({
          where: { id: effect.leadId, tenantId: effect.tenantId }, select: { telefone: true },
        });
    const session = await prisma.sessaoWhatsapp.findFirst({
      where: { tenantId: effect.tenantId, status: 'CONECTADO' },
      select: { instanceName: true },
    });
    if (!destination?.telefone || !session?.instanceName) throw new Error('AGENDA_EFFECT_DESTINATION_UNAVAILABLE');
    const sent = await sender.send(session.instanceName, destination.telefone, effect.mensagem, effect.chaveIdempotencia);
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

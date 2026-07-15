import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { agendaNoShowEventos } from '../observabilidade/agenda-comercial-metrics';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda, obterNoShowGraceMinutes } from './coerencia-agenda-estado';

const LEASE_MS = 60_000;
export const NO_SHOW_OWNER = `agenda-no-show:${process.pid}:${randomUUID()}`;

export async function reivindicarProximoNoShow(owner = NO_SHOW_OWNER, now = new Date()) {
  const graceMinutes = obterNoShowGraceMinutes();
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT a."id" FROM "atividades" a
      JOIN "leads" l ON l."id" = a."leadId"
      WHERE a."tipo" IN ('AVALIACAO', 'REUNIAO')
        AND a."statusAgendamento" IN ('PENDENTE', 'CONFIRMADO')
        AND a."substituidaPorId" IS NULL
        AND a."noShowProcessadoEm" IS NULL
        AND a."agendadoPara" + (${graceMinutes} * interval '1 minute') <= ${now}
        AND l."status" = 'VISITA_AGENDADA'
        AND (a."noShowLeaseAte" IS NULL OR a."noShowLeaseAte" <= ${now})
      ORDER BY a."agendadoPara" ASC, a."id" ASC
      FOR UPDATE OF a SKIP LOCKED LIMIT 1
    `;
    if (!candidates[0]) return null;
    return tx.atividade.update({
      where: { id: candidates[0].id },
      data: { noShowLeaseOwner: owner, noShowLeaseAte: new Date(now.getTime() + LEASE_MS), noShowFencingToken: { increment: 1 } },
      include: { lead: { select: { tenantId: true } } },
    });
  });
}

export async function executarProximoNoShowAgenda(owner = NO_SHOW_OWNER, now = new Date()): Promise<boolean> {
  const activity = await reivindicarProximoNoShow(owner, now);
  if (!activity) return false;
  const identity = `no-show:${activity.id}:${activity.agendadoPara?.toISOString()}:${AGENDA_COMMERCIAL_POLICY_VERSION}`;
  const result = await executarComandoAgenda({
    operacao: 'NO_SHOW', tenantId: activity.lead.tenantId, leadId: activity.leadId, atividadeId: activity.id,
    requestIdentity: { source: 'WORKER', id: identity }, ator: 'agenda-no-show-worker', origem: 'WORKER_NO_SHOW',
    motivo: 'Ausencia apos grace period', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
    ocorridoEm: now, expectedVersion: activity.versao, parteAusente: 'LEAD',
  });
  await prisma.atividade.updateMany({
    where: { id: activity.id, noShowLeaseOwner: owner, noShowFencingToken: activity.noShowFencingToken },
    data: { noShowProcessadoEm: new Date(), noShowReasonCode: result.reasonCode, noShowLeaseOwner: null, noShowLeaseAte: null },
  });
  agendaNoShowEventos.inc({ resultado: result.reasonCode.toLowerCase() });
  return true;
}

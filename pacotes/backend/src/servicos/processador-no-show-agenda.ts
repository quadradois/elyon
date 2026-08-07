import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { agendaNoShowEventos } from '../observabilidade/agenda-comercial-metrics';
import type { AgendaPilotScope } from './agenda-pilot-config';
import {
  AGENDA_COMMERCIAL_POLICY_VERSION,
  executarComandoAgenda,
  obterChaveRequisicaoAgenda,
  obterNoShowGraceMinutes,
  type AgendaCommandResult,
  type MarcarNoShowCommand,
} from './coerencia-agenda-estado';

const LEASE_MS = 60_000;
export const NO_SHOW_OWNER = `agenda-no-show:${process.pid}:${randomUUID()}`;

export async function reivindicarProximoNoShow(
  scope: AgendaPilotScope | undefined,
  owner = NO_SHOW_OWNER,
  now = new Date(),
) {
  if (!scope) return null;
  const startedAt = new Date(scope.startedAtUtc);
  if (!Number.isFinite(startedAt.getTime())) return null;
  const graceMinutes = obterNoShowGraceMinutes();
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT a."id" FROM "atividades" a
      JOIN "leads" l ON l."id" = a."leadId"
      JOIN "tenants" t ON t."id" = l."tenantId" AND t."status" = 'ATIVO'
      WHERE a."tipo" IN ('AVALIACAO', 'REUNIAO')
        AND l."tenantId" = ${scope.tenantId}
        AND (
          (a."statusAgendamento" IN ('PENDENTE', 'CONFIRMADO') AND l."status" = 'VISITA_AGENDADA')
          OR EXISTS (
            SELECT 1 FROM "comandos_agenda_ledger" c
            WHERE c."atividadeId" = a."id" AND c."operacao" = 'NO_SHOW'
          )
        )
        AND a."substituidaPorId" IS NULL
        AND a."noShowProcessadoEm" IS NULL
        AND a."agendadoPara" >= ${startedAt}
        AND a."agendadoPara" + (${graceMinutes} * interval '1 minute') <= ${now}
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

type NoShowClaim = NonNullable<Awaited<ReturnType<typeof reivindicarProximoNoShow>>>;
type NoShowExecutor = (command: MarcarNoShowCommand) => Promise<AgendaCommandResult>;

function leaseLost(atividadeId: string): AgendaCommandResult {
  return { success: false, reasonCode: 'NO_SHOW_LEASE_LOST', atividadeId };
}

async function liberarClaimTransitorio(activity: NoShowClaim, owner: string): Promise<void> {
  await prisma.atividade.updateMany({
    where: {
      id: activity.id, noShowLeaseOwner: owner, noShowFencingToken: activity.noShowFencingToken,
      noShowProcessadoEm: null,
    },
    data: { noShowLeaseOwner: null, noShowLeaseAte: null },
  });
}

export async function finalizarClaimNoShow(
  activity: NoShowClaim,
  owner: string,
  result: AgendaCommandResult,
  now = new Date(),
): Promise<AgendaCommandResult> {
  if (!result.decisionPersisted || !result.decisionKey || !result.decisionOutcome) return leaseLost(activity.id);
  const finalized = await prisma.$transaction(async (tx) => {
    const decision = await tx.comandoAgendaLedger.findUnique({
      where: { chaveRequisicao: result.decisionKey },
      select: { tenantId: true, leadId: true, atividadeId: true, outcome: true },
    });
    if (!decision
      || decision.tenantId !== activity.lead.tenantId
      || decision.leadId !== activity.leadId
      || decision.atividadeId !== activity.id
      || decision.outcome !== result.decisionOutcome) return 0;
    const closed = await tx.atividade.updateMany({
      where: {
        id: activity.id, noShowLeaseOwner: owner, noShowFencingToken: activity.noShowFencingToken,
        noShowProcessadoEm: null,
      },
      data: {
        noShowProcessadoEm: now, noShowReasonCode: result.decisionOutcome,
        noShowLeaseOwner: null, noShowLeaseAte: null,
      },
    });
    return closed.count;
  });
  return finalized === 1 ? result : leaseLost(activity.id);
}

export async function processarNoShowReivindicado(
  activity: NoShowClaim,
  owner: string,
  now = new Date(),
  deps: { executar?: NoShowExecutor; aposComando?: () => Promise<void> } = {},
): Promise<AgendaCommandResult> {
  const identity = `no-show:${activity.id}:${activity.agendadoPara?.toISOString()}:${AGENDA_COMMERCIAL_POLICY_VERSION}`;
  const commandBase: MarcarNoShowCommand = {
    operacao: 'NO_SHOW', tenantId: activity.lead.tenantId, leadId: activity.leadId, atividadeId: activity.id,
    requestIdentity: { source: 'WORKER', id: identity }, ator: 'agenda-no-show-worker', origem: 'WORKER_NO_SHOW',
    motivo: 'Ausencia apos grace period', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
    ocorridoEm: now, expectedVersion: activity.versao, parteAusente: 'LEAD',
    noShowLease: {
      owner, fencingToken: activity.noShowFencingToken, leaseAte: activity.noShowLeaseAte!,
    },
  };
  const prior = await prisma.comandoAgendaLedger.findUnique({
    where: { chaveRequisicao: obterChaveRequisicaoAgenda(commandBase) },
    select: { resultado: true },
  });
  const priorResult = prior?.resultado as AgendaCommandResult | undefined;
  const command = priorResult?.decisionExpectedVersion === undefined
    ? commandBase
    : { ...commandBase, expectedVersion: priorResult.decisionExpectedVersion };
  const result = await (deps.executar || executarComandoAgenda)(command);
  if (deps.aposComando) await deps.aposComando();
  if (result.reasonCode === 'NO_SHOW_LEASE_LOST') return result;
  if (result.transient || !result.decisionPersisted) {
    await liberarClaimTransitorio(activity, owner);
    return result;
  }
  return finalizarClaimNoShow(activity, owner, result, now);
}

export async function executarProximoNoShowAgenda(
  scope: AgendaPilotScope | undefined,
  owner = NO_SHOW_OWNER,
  now = new Date(),
): Promise<boolean> {
  let activity;
  try {
    activity = await reivindicarProximoNoShow(scope, owner, now);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2028' || String((error as Error).message).includes('Unable to start a transaction')) {
      agendaNoShowEventos.inc({ resultado: 'claim_contention' });
      return false;
    }
    throw error;
  }
  if (!activity) return false;
  const result = await processarNoShowReivindicado(activity, owner, now);
  agendaNoShowEventos.inc({ resultado: result.reasonCode.toLowerCase() });
  return true;
}

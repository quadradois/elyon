import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { agendaComercialEventos } from '../observabilidade/agenda-comercial-metrics';

export const AGENDA_COMMERCIAL_POLICY_VERSION = 'agenda-commercial-v1';

export type AgendaCommandSource = 'MANUAL_API' | 'PUBLIC_TOKEN' | 'INBOUND_BATCH' | 'WORKER' | 'BASELINE';
export type AgendaCommandIdentity = { source: AgendaCommandSource; id: string };
export type AgendaReasonCode =
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW_RECORDED'
  | 'COMMAND_REPLAY'
  | 'REQUEST_ID_CONFLICT'
  | 'TENANT_OWNERSHIP_DENIED'
  | 'ACTIVITY_ALREADY_REPLACED'
  | 'STALE_EVENT'
  | 'STATE_TRANSITION_DENIED'
  | 'AGENDA_REPLACEMENT_FAILED'
  | 'INVALID_COMMAND';

type BaseCommand = {
  tenantId: string;
  leadId: string;
  atividadeId: string;
  requestIdentity: AgendaCommandIdentity;
  ator: string;
  origem: string;
  motivo: string;
  policyVersion: string;
  ocorridoEm: Date;
  expectedVersion: number;
};

export type CancelarAgendaCommand = BaseCommand & { operacao: 'CANCELAR' };
export type ReagendarAgendaCommand = BaseCommand & { operacao: 'REAGENDAR'; novoHorario: Date; novoTitulo?: string; novaDescricao?: string };
export type MarcarNoShowCommand = BaseCommand & { operacao: 'NO_SHOW'; parteAusente: 'LEAD' | 'CORRETOR' };
export type AgendaCommand = CancelarAgendaCommand | ReagendarAgendaCommand | MarcarNoShowCommand;

export type AgendaCommandResult = {
  success: boolean;
  reasonCode: AgendaReasonCode;
  atividadeId: string;
  atividadeResultanteId?: string;
  leadStatus?: string;
  replay?: boolean;
};

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function normalizar(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9:_ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

function validar(command: AgendaCommand): AgendaReasonCode | null {
  if (!command.tenantId?.trim() || !command.leadId?.trim() || !command.atividadeId?.trim()) return 'INVALID_COMMAND';
  if (!command.requestIdentity?.id?.trim() || !command.requestIdentity.source) return 'INVALID_COMMAND';
  if (!command.ator?.trim() || !command.origem?.trim() || normalizar(command.motivo).length < 3) return 'INVALID_COMMAND';
  if (command.policyVersion !== AGENDA_COMMERCIAL_POLICY_VERSION) return 'INVALID_COMMAND';
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0) return 'INVALID_COMMAND';
  if (!Number.isFinite(command.ocorridoEm?.getTime())) return 'INVALID_COMMAND';
  if (command.operacao === 'REAGENDAR' && (!Number.isFinite(command.novoHorario?.getTime()) || command.novoHorario <= command.ocorridoEm)) return 'INVALID_COMMAND';
  return null;
}

function chaveRequisicao(command: AgendaCommand): string {
  return hash(['agenda-command-v1', command.tenantId, command.requestIdentity.source, command.requestIdentity.id.trim()]);
}

function fingerprint(command: AgendaCommand): string {
  return hash([
    'agenda-command-fingerprint-v1', command.operacao, command.tenantId, command.leadId, command.atividadeId,
    command.operacao === 'REAGENDAR' ? command.novoHorario.toISOString() : '',
    command.operacao === 'REAGENDAR' ? normalizar(command.novoTitulo || '') : '',
    command.operacao === 'REAGENDAR' ? hash(['agenda-description-v1', command.novaDescricao || '']) : '',
    command.operacao === 'NO_SHOW' ? command.parteAusente : '',
    normalizar(command.motivo), command.policyVersion, normalizar(command.ator), normalizar(command.origem),
    String(command.expectedVersion),
  ]);
}

function resultadoFalha(command: AgendaCommand, reasonCode: AgendaReasonCode): AgendaCommandResult {
  agendaComercialEventos.inc({ resultado: reasonCode.toLowerCase() });
  return { success: false, reasonCode, atividadeId: command.atividadeId };
}

async function executarNaTransacao(tx: Prisma.TransactionClient, command: AgendaCommand): Promise<AgendaCommandResult> {
  const key = chaveRequisicao(command);
  const fp = fingerprint(command);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${command.tenantId}:${command.leadId}:agenda-commercial`}, 0))`;

  const replay = await tx.comandoAgendaLedger.findUnique({ where: { chaveRequisicao: key } });
  if (replay) {
    if (replay.fingerprint !== fp) return { success: false, reasonCode: 'REQUEST_ID_CONFLICT', atividadeId: command.atividadeId };
    await tx.comandoAgendaLedger.update({ where: { id: replay.id }, data: { ultimoReplayEm: new Date() } });
    return { ...(replay.resultado as AgendaCommandResult), reasonCode: 'COMMAND_REPLAY', replay: true };
  }

  const atividade = await tx.atividade.findFirst({
    where: { id: command.atividadeId, leadId: command.leadId, lead: { tenantId: command.tenantId } },
    include: { lead: { select: { id: true, status: true, tenantId: true } } },
  });
  if (!atividade) return { success: false, reasonCode: 'TENANT_OWNERSHIP_DENIED', atividadeId: command.atividadeId };
  if (atividade.versao !== command.expectedVersion) return { success: false, reasonCode: 'STALE_EVENT', atividadeId: command.atividadeId };
  if (atividade.substituidaPorId) return { success: false, reasonCode: 'ACTIVITY_ALREADY_REPLACED', atividadeId: command.atividadeId };
  if (!atividade.agendadoPara || !['AVALIACAO', 'REUNIAO'].includes(atividade.tipo)) {
    return { success: false, reasonCode: 'STATE_TRANSITION_DENIED', atividadeId: command.atividadeId };
  }
  if (!['PENDENTE', 'CONFIRMADO'].includes(atividade.statusAgendamento || '') || atividade.lead.status !== 'VISITA_AGENDADA') {
    const stale = ['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'ONBOARDING', 'CAPTADO'].includes(atividade.lead.status);
    return { success: false, reasonCode: stale ? 'STALE_EVENT' : 'STATE_TRANSITION_DENIED', atividadeId: command.atividadeId };
  }

  const milestoneKey = hash(['agenda-milestone-v1', key, command.operacao]);
  let result: AgendaCommandResult;
  let milestoneType: string;
  let replacementId: string | undefined;

  if (command.operacao === 'REAGENDAR') {
    const substituta = await tx.atividade.create({ data: {
      leadId: atividade.leadId,
      tipo: atividade.tipo,
      canal: atividade.canal,
      titulo: command.novoTitulo?.trim() || `Reagendamento: ${atividade.titulo}`,
      descricao: command.novaDescricao?.trim() || atividade.descricao,
      duracao: atividade.duracao,
      agendadoPara: command.novoHorario,
      criadoPor: command.ator,
      statusAgendamento: 'PENDENTE',
      tokenConfirmacao: randomUUID(),
      statusConfirmacaoCorretor: atividade.tipo === 'REUNIAO' ? 'PENDENTE' : null,
      tokenConfirmacaoCorretor: atividade.tipo === 'REUNIAO' ? randomUUID() : null,
    } });
    replacementId = substituta.id;
    const encerrada = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion, substituidaPorId: null, statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] } },
      data: { statusAgendamento: 'CANCELADO', canceladoPor: command.ator, canceladoEm: command.ocorridoEm,
        motivoCancelamento: command.motivo, substituidaPorId: substituta.id, versao: { increment: 1 } },
    });
    if (encerrada.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    milestoneType = 'VISITA_REAGENDADA';
    result = { success: true, reasonCode: 'RESCHEDULED', atividadeId: atividade.id,
      atividadeResultanteId: substituta.id, leadStatus: 'VISITA_AGENDADA' };
  } else {
    const statusAgenda = command.operacao === 'CANCELAR' ? 'CANCELADO' : 'NAO_COMPARECEU';
    const updated = await tx.atividade.updateMany({
      where: { id: atividade.id, leadId: command.leadId, versao: command.expectedVersion, substituidaPorId: null, statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] } },
      data: { statusAgendamento: statusAgenda, canceladoPor: command.operacao === 'CANCELAR' ? command.ator : atividade.canceladoPor,
        canceladoEm: command.operacao === 'CANCELAR' ? command.ocorridoEm : atividade.canceladoEm,
        motivoCancelamento: command.operacao === 'CANCELAR' ? command.motivo : atividade.motivoCancelamento,
        completadoEm: command.operacao === 'NO_SHOW' ? command.ocorridoEm : atividade.completadoEm, versao: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error('AGENDA_CONCURRENT_WRITE');
    const lead = await tx.lead.updateMany({ where: { id: command.leadId, tenantId: command.tenantId, status: 'VISITA_AGENDADA' }, data: { status: 'TENTATIVA_AGENDAMENTO' } });
    if (lead.count !== 1) throw new Error('LEAD_CONCURRENT_WRITE');
    milestoneType = command.operacao === 'CANCELAR' ? 'VISITA_CANCELADA' : 'VISITA_NAO_COMPARECEU';
    result = { success: true, reasonCode: command.operacao === 'CANCELAR' ? 'CANCELLED' : 'NO_SHOW_RECORDED',
      atividadeId: atividade.id, atividadeResultanteId: atividade.id, leadStatus: 'TENTATIVA_AGENDAMENTO' };
  }

  await tx.milestoneAgenda.create({ data: {
    tenantId: command.tenantId, leadId: command.leadId, atividadeId: command.atividadeId,
    atividadeSubstitutaId: replacementId, tipo: milestoneType, ator: command.ator,
    origem: command.origem, motivo: command.motivo, reasonCode: result.reasonCode,
    parteAusente: command.operacao === 'NO_SHOW' ? command.parteAusente : null,
    ocorridoEm: command.ocorridoEm, chaveIdempotencia: milestoneKey,
  } });
  await tx.comandoAgendaLedger.create({ data: {
    chaveRequisicao: key, fingerprint: fp, operacao: command.operacao, tenantId: command.tenantId,
    leadId: command.leadId, atividadeId: command.atividadeId,
    atividadeResultanteId: result.atividadeResultanteId || command.atividadeId,
    outcome: result.reasonCode, resultado: result as unknown as Prisma.InputJsonValue,
  } });
  return result;
}

export async function executarComandoAgenda(command: AgendaCommand): Promise<AgendaCommandResult> {
  const invalid = validar(command);
  if (invalid) return resultadoFalha(command, invalid);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await prisma.$transaction((tx) => executarNaTransacao(tx as unknown as Prisma.TransactionClient, command), { isolationLevel: 'Serializable' });
      agendaComercialEventos.inc({ resultado: result.reasonCode.toLowerCase() });
      return result;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (['P2002', 'P2034'].includes(code || '') && attempt < 3) continue;
      agendaComercialEventos.inc({ resultado: command.operacao === 'REAGENDAR' ? 'agenda_replacement_failed' : 'rollback' });
      return { success: false, reasonCode: command.operacao === 'REAGENDAR' ? 'AGENDA_REPLACEMENT_FAILED' : 'STATE_TRANSITION_DENIED', atividadeId: command.atividadeId };
    }
  }
  return resultadoFalha(command, 'STATE_TRANSITION_DENIED');
}
